package service

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
)
// handleTable is the single bidirectional primitive behind every model-handle
// space: cN/dN/bN/wN source handles, iN issue handles, res://NNNN resource
// handles, and the ref-N / c000 ingest handles exposed through HandleTable.
//
// It maps a durable dedup key to a sequentially allocated handle and stores
// the durable value plus optional metadata under one lock, so a resolvable
// handle can never be observed without its metadata. The key and the value
// may differ (web references dedup on a canonicalized URL but decode back to
// the original raw URL). Entries are never removed, which makes the counter
// equivalent to the historical len(map)+1 allocation and keeps handle
// numbering stable for the lifetime of the table.
type handleTable[M any] struct {
	mu            sync.RWMutex
	prefix        string
	width         int
	next          int
	handleByKey   map[string]string
	entryByHandle map[string]*handleEntry[M]
}

type handleEntry[M any] struct {
	value       string // durable value a handle decodes back to
	meta        M
	wordBounded *regexp.Regexp
}

// handlePair is a snapshot row for text codecs (compaction/decoding).
type handlePair struct {
	value  string
	handle string
	// wordBounded matches the handle only on word boundaries. It is compiled
	// once at registration because DecodeKnownText runs on every streamed
	// chunk, where recompiling per handle per chunk dominated the cost.
	wordBounded *regexp.Regexp
}

// newHandleTable creates a handle space such as c1 (prefix="c", width=0,
// start=1), c000 (prefix="c", width=3, start=0) or res://0001
// (prefix="res://", width=4, start=1).
func newHandleTable[M any](prefix string, width, start int) *handleTable[M] {
	return &handleTable[M]{
		prefix:        prefix,
		width:         width,
		next:          start,
		handleByKey:   make(map[string]string),
		entryByHandle: make(map[string]*handleEntry[M]),
	}
}

// register returns the handle assigned to key, allocating the next one on
// first use. value is what the handle decodes back to; merge, when non-nil,
// folds the metadata of a repeated registration into the existing entry.
func (t *handleTable[M]) register(key, value string, meta M, merge func(dst *M, src M)) string {
	if t == nil || key == "" {
		return ""
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if handle, ok := t.handleByKey[key]; ok {
		if merge != nil {
			merge(&t.entryByHandle[handle].meta, meta)
		}
		return handle
	}
	number := fmt.Sprintf("%d", t.next)
	if t.width > 0 {
		number = fmt.Sprintf("%0*d", t.width, t.next)
	}
	t.next++
	handle := t.prefix + number
	t.handleByKey[key] = handle
	t.entryByHandle[handle] = &handleEntry[M]{
		value:       value,
		meta:        meta,
		wordBounded: regexp.MustCompile(`\b` + regexp.QuoteMeta(handle) + `\b`),
	}
	return handle
}

// handleForKey returns an existing handle without allocating one.
func (t *handleTable[M]) handleForKey(key string) (string, bool) {
	if t == nil {
		return "", false
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	handle, ok := t.handleByKey[key]
	return handle, ok
}

// resolve returns the durable value and metadata snapshot for a known handle.
func (t *handleTable[M]) resolve(handle string) (string, M, bool) {
	var zero M
	if t == nil {
		return "", zero, false
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	entry, ok := t.entryByHandle[handle]
	if !ok {
		return "", zero, false
	}
	return entry.value, entry.meta, true
}

// has reports whether handle exists in this table.
func (t *handleTable[M]) has(handle string) bool {
	if t == nil {
		return false
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	_, ok := t.entryByHandle[handle]
	return ok
}

func (t *handleTable[M]) size() int {
	if t == nil {
		return 0
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	return len(t.entryByHandle)
}

// pairs returns a value/handle snapshot for text codecs. Callers own ordering
// (e.g. longest-value-first for substring compaction).
func (t *handleTable[M]) pairs() []handlePair {
	if t == nil {
		return nil
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	out := make([]handlePair, 0, len(t.entryByHandle))
	for handle, entry := range t.entryByHandle {
		out = append(out, handlePair{
			value:       entry.value,
			handle:      handle,
			wordBounded: entry.wordBounded,
		})
	}
	return out
}

// HandleTable is a typed, invocation-local bidirectional mapping used when a
// prompt needs compact handles for durable values (wiki issue iN handles,
// ingest ref-N slug handles, c000 citation-batch handles). Handles must never
// be persisted; Resolve converts model output back to the durable value first.
// It is the exported word-boundary-aware wrapper over handleTable.
type HandleTable struct {
	table *handleTable[struct{}]
}

// NewHandleTable creates a handle space such as c000 (prefix=c, width=3,
// start=0) or ref-1 (prefix=ref-, width=0, start=1).
func NewHandleTable(prefix string, width, start int) *HandleTable {
	return &HandleTable{table: newHandleTable[struct{}](prefix, width, start)}
}

// Register returns the stable handle assigned to value in this table.
func (t *HandleTable) Register(value string) string {
	if t == nil {
		return ""
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return t.table.register(value, value, struct{}{}, nil)
}

// Handle returns an already registered handle without creating one.
func (t *HandleTable) Handle(value string) (string, bool) {
	if t == nil {
		return "", false
	}
	return t.table.handleForKey(value)
}

// Resolve converts a known model handle back to its durable value.
func (t *HandleTable) Resolve(handle string) (string, bool) {
	if t == nil {
		return "", false
	}
	value, _, ok := t.table.resolve(strings.TrimSpace(handle))
	return value, ok
}

func (t *HandleTable) Empty() bool {
	return t == nil || t.table.size() == 0
}

func (t *HandleTable) Len() int {
	if t == nil {
		return 0
	}
	return t.table.size()
}

// EncodeKnownText replaces already-registered durable values with their model
// handles. Longer values are processed first to avoid substring shadowing.
func (t *HandleTable) EncodeKnownText(value string) string {
	if t == nil || value == "" {
		return value
	}
	pairs := t.table.pairs()
	sort.SliceStable(pairs, func(i, j int) bool { return len(pairs[i].value) > len(pairs[j].value) })
	for _, item := range pairs {
		value = strings.ReplaceAll(value, item.value, item.handle)
	}
	return value
}

// DecodeKnownText restores registered handles in complete text. Unlike the
// resource codec, replacement is word-boundary-aware so short handles such as
// i1 cannot fire inside ordinary prose tokens.
func (t *HandleTable) DecodeKnownText(value string) string {
	if t == nil || value == "" {
		return value
	}
	pairs := t.table.pairs()
	sort.SliceStable(pairs, func(i, j int) bool { return len(pairs[i].handle) > len(pairs[j].handle) })
	for _, item := range pairs {
		if item.wordBounded == nil {
			continue
		}
		// A durable value may legally contain '$'. ReplaceAllString would
		// interpret it as a regexp expansion, so use a literal callback.
		durable := item.value
		value = item.wordBounded.ReplaceAllStringFunc(value, func(string) string { return durable })
	}
	return value
}
