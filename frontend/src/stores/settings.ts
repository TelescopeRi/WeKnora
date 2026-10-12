import { defineStore } from "pinia";
import { getApiBaseUrl } from "@/utils/api-base";
import { loadAndReconcileSettings } from "@/stores/settingsStorage";

// 定义设置接口
interface Settings {
  endpoint: string;
  apiKey: string;
  knowledgeBaseId: string;
  selectedKnowledgeBases: string[];  // 当前选中的知识库ID列表
  modelConfig: ModelConfig;  // 模型配置
  ollamaConfig: OllamaConfig;  // Ollama配置
  autoCheckUpdate?: boolean; // 是否自动检查并下载更新
}

// 单个模型项接口
interface ModelItem {
  id: string;  // 唯一ID
  name: string;  // 显示名称
  source: 'local' | 'remote';  // 模型来源
  modelName: string;  // 模型标识
  baseUrl?: string;  // 远程API URL
  apiKey?: string;  // 远程API Key
  dimension?: number;  // Embedding专用：向量维度
  interfaceType?: 'ollama' | 'openai';  // VLLM专用：接口类型
  isDefault?: boolean;  // 是否为默认模型
}

// 模型配置接口 - 支持多模型
interface ModelConfig {
  chatModels: ModelItem[];
  embeddingModels: ModelItem[];
  rerankModels: ModelItem[];
  vllmModels: ModelItem[];  // VLLM视觉模型
}

// Ollama 配置接口
interface OllamaConfig {
  baseUrl: string;  // Ollama 服务地址
  enabled: boolean;  // 是否启用
}

// 默认设置
const defaultSettings: Settings = {
  endpoint: getApiBaseUrl(),
  apiKey: "",
  knowledgeBaseId: "",
  selectedKnowledgeBases: [],  // 默认为空数组
  modelConfig: {
    chatModels: [],
    embeddingModels: [],
    rerankModels: [],
    vllmModels: []
  },
  ollamaConfig: {
    baseUrl: "http://localhost:11434",
    enabled: true
  },
  autoCheckUpdate: true,
};

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    // 从本地存储加载设置，如果没有则使用默认设置
    settings: loadAndReconcileSettings(defaultSettings),
  }),

  getters: {
    // 获取模型配置
    modelConfig: (state) => state.settings.modelConfig || defaultSettings.modelConfig,

    // 是否自动检查并下载更新
    isAutoCheckUpdateEnabled: (state) => state.settings.autoCheckUpdate ?? true,
  },

  actions: {
    // 保存设置
    saveSettings(settings: Settings) {
      this.settings = { ...settings };
      // 保存到localStorage
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // 获取设置
    getSettings(): Settings {
      return this.settings;
    },

    // 获取API端点
    getEndpoint(): string {
      return this.settings.endpoint || defaultSettings.endpoint;
    },

    // 获取API Key
    getApiKey(): string {
      return this.settings.apiKey;
    },

    // 获取知识库ID
    getKnowledgeBaseId(): string {
      return this.settings.knowledgeBaseId;
    },

    // 更新模型配置
    updateModelConfig(config: Partial<ModelConfig>) {
      this.settings.modelConfig = { ...this.settings.modelConfig, ...config };
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // 更新 Ollama 配置
    updateOllamaConfig(config: Partial<OllamaConfig>) {
      this.settings.ollamaConfig = { ...this.settings.ollamaConfig, ...config };
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // 选择知识库（替换整个列表）
    selectKnowledgeBases(kbIds: string[]) {
      this.settings.selectedKnowledgeBases = kbIds;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // 添加单个知识库
    addKnowledgeBase(kbId: string) {
      if (!this.settings.selectedKnowledgeBases.includes(kbId)) {
        this.settings.selectedKnowledgeBases.push(kbId);
        localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
      }
    },

    // 移除单个知识库
    removeKnowledgeBase(kbId: string) {
      this.settings.selectedKnowledgeBases =
        this.settings.selectedKnowledgeBases.filter((id: string) => id !== kbId);
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // 清空知识库选择
    clearKnowledgeBases() {
      this.settings.selectedKnowledgeBases = [];
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // 获取选中的知识库列表
    getSelectedKnowledgeBases(): string[] {
      return this.settings.selectedKnowledgeBases || [];
    },

    // 启用/禁用自动检查更新
    toggleAutoCheckUpdate(enabled: boolean) {
      this.settings.autoCheckUpdate = enabled;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
  },
});
