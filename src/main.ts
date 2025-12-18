import { App, Plugin, PluginSettingTab, TFile, Notice, Setting } from 'obsidian';
import axios from 'axios';

interface AIInsightSettings {
	// AI Service Keys
	openaiApiKey: string;
	anthropicApiKey: string;
	googleApiKey: string; // Gemini API Key

	// ElevenLabs Settings
	elevenLabsApiKey: string;
	elevenLabsVoiceId: string;

	// Google Drive Settings
	googleAccessToken: string; // OAuth Access Token for Drive

	// Preferences
	selectedAI: 'openai' | 'anthropic' | 'google';
	insightType: 'summary' | 'key-points' | 'questions' | 'action-items';
	geminiModel: string;
}

const DEFAULT_SETTINGS: AIInsightSettings = {
	openaiApiKey: '',
	anthropicApiKey: '',
	googleApiKey: '',
	elevenLabsApiKey: '',
	elevenLabsVoiceId: '',
	googleAccessToken: '',
	selectedAI: 'google', // Default to Google as per plan
	insightType: 'summary',
	geminiModel: 'gemini-1.5-flash'
};

export default class AIInsightPlugin extends Plugin {
	settings: AIInsightSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'generate-insight',
			name: 'Generate Insight from Current Note',
			callback: () => this.generateInsight()
		});

		this.addCommand({
			id: 'generate-audio-review',
			name: 'Generate Audio Review (Gemini + ElevenLabs + Drive)',
			callback: () => this.generateAudioReview()
		});

		this.addSettingTab(new AIInsightSettingTab(this.app, this));
	}

	onunload() {
		// Cleanup if needed
	}

	getPromptForInsightType(content: string): string {
		switch (this.settings.insightType) {
			case 'summary':
				return `다음 노트 내용을 요약해 주세요: ${content}`;
			case 'key-points':
				return `다음 노트 내용에서 주요 포인트를 추출해 주세요: ${content}`;
			case 'questions':
				return `다음 노트 내용을 바탕으로 관련 질문을 생성해 주세요: ${content}`;
			case 'action-items':
				return `다음 노트 내용에서 실행 가능한 액션 아이템을 추출해 주세요: ${content}`;
			default:
				return `다음 노트 내용을 바탕으로 인사이트를 생성해 주세요: ${content}`;
		}
	}

	getInsightTypeLabel(): string {
		switch (this.settings.insightType) {
			case 'summary':
				return '요약';
			case 'key-points':
				return '주요 포인트';
			case 'questions':
				return '관련 질문';
			case 'action-items':
				return '액션 아이템';
			default:
				return '인사이트';
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	async generateInsight() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('활성 파일이 없습니다.');
			return;
		}

		const content = await this.app.vault.read(activeFile);
		if (!content.trim()) {
			new Notice('노트 내용이 비어 있습니다.');
			return;
		}

		let insight = '';
		try {
			const prompt = this.getPromptForInsightType(content);
			switch (this.settings.selectedAI) {
				case 'openai':
					insight = await this.callOpenAI(prompt);
					break;
				case 'anthropic':
					insight = await this.callAnthropic(prompt);
					break;
				case 'google':
					insight = await this.callGoogle(prompt);
					break;
			}

			// 새로운 노트 생성
			const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
			const originalName = activeFile.basename;
			const newFileName = `Insights from ${originalName} - ${date}.md`;
			const insightContent = `# AI 인사이트: ${originalName}\n\n**원본 노트:** [[${originalName}]]\n\n## ${this.getInsightTypeLabel()}\n${insight}`;
			await this.app.vault.create(newFileName, insightContent);
			new Notice(`새로운 인사이트 노트가 생성되었습니다: ${newFileName}`);
		} catch (error) {
			new Notice('인사이트 생성 중 오류 발생: ' + (error as Error).message);
		}
	}
	async generateAudioReview() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('활성 파일이 없습니다.');
			return;
		}

		const content = await this.app.vault.read(activeFile);
		if (!content.trim()) {
			new Notice('노트 내용이 비어 있습니다.');
			return;
		}

		// Progress Indicator Wrapper
		const progressNotice = new Notice('Autio Review 시작...', 0);
		const updateProgress = (message: string) => {
			progressNotice.setMessage(message);
		};

		try {
			// Step 1: Gemini Script Generation
			updateProgress('Step 1/5: Gemini가 스크립트 작성 중...');
			const script = await this.generatePodcastScript(content);

			// Step 2: ElevenLabs Audio Generation
			updateProgress('Step 2/5: ElevenLabs 음성 생성 중...');
			const audioBuffer = await this.generateSpeech(script);

			// Step 3: Google Drive Upload
			updateProgress('Step 3/5: Google Drive 업로드 중...');
			const fileName = `Audio Review - ${activeFile.basename} - ${Date.now()}.mp3`;
			const driveLink = await this.uploadToDrive(audioBuffer, fileName);

			// Step 4: Update Progress
			updateProgress('Step 4/5: 노트에 플레이어 삽입 중...');

			// Step 5: Embed in Obsidian
			const playerHtml = `<br>\n<audio controls src="${driveLink}" preload="metadata" style="width: 100%;"></audio>\n<br>\n`;

			// Prepend to file
			const currentContent = await this.app.vault.read(activeFile);
			await this.app.vault.modify(activeFile, playerHtml + currentContent);

			updateProgress('완료! 오디오 리뷰가 생성되었습니다.');
			setTimeout(() => progressNotice.hide(), 5000);

		} catch (error) {
			updateProgress(`오류 발생: ${(error as Error).message}`);
			console.error(error);
			setTimeout(() => progressNotice.hide(), 5000);
		}
	}

	async generatePodcastScript(content: string): Promise<string> {
		const prompt = `
당신은 프로페셔널한 팟캐스트 진행자입니다. 다음 노트의 내용을 바탕으로 청중에게 설명하는 듯한 자연스러운 1인 내레이션 스크립트를 작성해주세요.
- 노트 내용: ${content}
- 어조: 친근하면서도 지적인, "이 부분은 꼭 기억하세요" 같은 추임새 포함.
- 형식: 오직 스크립트 내용만 출력하세요. (제목이나 지시문 제외)
`;
		// Using Gemini for this as per plan
		return await this.callGoogle(prompt);
	}

	async generateSpeech(text: string): Promise<ArrayBuffer> {
		if (!this.settings.elevenLabsApiKey || !this.settings.elevenLabsVoiceId) {
			throw new Error('ElevenLabs API Key 또는 Voice ID가 설정되지 않았습니다.');
		}

		const response = await axios.post(
			`https://api.elevenlabs.io/v1/text-to-speech/${this.settings.elevenLabsVoiceId}`,
			{
				text: text,
				model_id: 'eleven_turbo_v2_5',
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75
				}
			},
			{
				headers: {
					'xi-api-key': this.settings.elevenLabsApiKey,
					'Content-Type': 'application/json'
				},
				responseType: 'arraybuffer'
			}
		);
		return response.data;
	}

	async uploadToDrive(data: ArrayBuffer, fileName: string): Promise<string> {
		if (!this.settings.googleAccessToken) {
			throw new Error('Google Drive Access Token이 설정되지 않았습니다.');
		}

		// 1. Upload File
		const metadata = {
			name: fileName,
			mimeType: 'audio/mpeg'
		};

		const formData = new FormData();
		formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
		formData.append('file', new Blob([data], { type: 'audio/mpeg' }));

		const uploadResponse = await axios.post(
			'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
			formData,
			{
				headers: {
					'Authorization': `Bearer ${this.settings.googleAccessToken}`
				}
			}
		);

		const fileId = uploadResponse.data.id;

		// 2. Make Public (Permission)
		await axios.post(
			`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
			{
				role: 'reader',
				type: 'anyone'
			},
			{
				headers: {
					'Authorization': `Bearer ${this.settings.googleAccessToken}`,
					'Content-Type': 'application/json'
				}
			}
		);

		// 3. Get WebContentLink (Direct download link logic slightly varies, usually webContentLink or constructing via ID)
		// For <audio src="..."> we usually need a direct stream link. 
		// Drive 'uc' export link is common for this: https://drive.google.com/uc?export=download&id=FILE_ID

		return `https://drive.google.com/uc?export=download&id=${fileId}`;
	}

	async callOpenAI(prompt: string): Promise<string> {
		const response = await axios.post('https://api.openai.com/v1/chat/completions', {
			model: 'gpt-3.5-turbo',
			messages: [{ role: 'user', content: prompt }]
		}, {
			headers: {
				'Authorization': `Bearer ${this.settings.openaiApiKey}`,
				'Content-Type': 'application/json'
			}
		});
		return response.data.choices[0].message.content;
	}

	async callAnthropic(prompt: string): Promise<string> {
		const response = await axios.post('https://api.anthropic.com/v1/messages', {
			model: 'claude-3-haiku-20240307',
			max_tokens: 1000,
			messages: [{ role: 'user', content: prompt }]
		}, {
			headers: {
				'x-api-key': this.settings.anthropicApiKey,
				'anthropic-version': '2023-06-01',
				'Content-Type': 'application/json'
			}
		});
		return response.data.content[0].text;
	}

	async callGoogle(prompt: string): Promise<string> {
		// Use configurable model, default to gemini-1.5-flash
		const model = this.settings.geminiModel || 'gemini-1.5-flash';
		const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.googleApiKey}`, {
			contents: [{ parts: [{ text: prompt }] }]
		}, {
			headers: {
				'Content-Type': 'application/json'
			}
		});
		return response.data.candidates[0].content.parts[0].text;
	}
}

class AIInsightSettingTab extends PluginSettingTab {
	plugin: AIInsightPlugin;

	constructor(app: App, plugin: AIInsightPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'AI Insight & Audio Review Settings' });

		// --- AI Selection ---
		new Setting(containerEl)
			.setName('기본 AI 서비스')
			.setDesc('인사이트 생성에 사용할 기본 AI를 선택하세요')
			.addDropdown(dropdown => dropdown
				.addOption('openai', 'ChatGPT (OpenAI)')
				.addOption('anthropic', 'Claude (Anthropic)')
				.addOption('google', 'Gemini (Google)')
				.setValue(this.plugin.settings.selectedAI)
				.onChange(async (value: string) => {
					this.plugin.settings.selectedAI = value as 'openai' | 'anthropic' | 'google';
					await this.plugin.saveSettings();
				}));

		// --- API Keys Section ---
		containerEl.createEl('h3', { text: 'API Keys' });

		new Setting(containerEl)
			.setName('Gemini API Key')
			.setDesc('Google AI Studio에서 발급받은 키 (Audio Review 스크립트 생성에 필수)')
			.addText(text => text
				.setPlaceholder('AIza...')
				.setValue(this.plugin.settings.googleApiKey)
				.onChange(async (value) => {
					this.plugin.settings.googleApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Gemini Model Name')
			.setDesc('사용할 Gemini 모델명 (예: gemini-1.5-flash)')
			.addText(text => text
				.setPlaceholder('gemini-1.5-flash')
				.setValue(this.plugin.settings.geminiModel)
				.onChange(async (value) => {
					this.plugin.settings.geminiModel = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('ChatGPT 사용 시 필요')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.openaiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Anthropic API Key')
			.setDesc('Claude 사용 시 필요')
			.addText(text => text
				.setPlaceholder('sk-ant-...')
				.setValue(this.plugin.settings.anthropicApiKey)
				.onChange(async (value) => {
					this.plugin.settings.anthropicApiKey = value;
					await this.plugin.saveSettings();
				}));

		// --- Audio Review Settings ---
		containerEl.createEl('h3', { text: 'Audio Review Settings (ElevenLabs & Drive)' });

		new Setting(containerEl)
			.setName('ElevenLabs API Key')
			.setDesc('음성 합성을 위한 ElevenLabs API 키')
			.addText(text => text
				.setPlaceholder('xi-...')
				.setValue(this.plugin.settings.elevenLabsApiKey)
				.onChange(async (value) => {
					this.plugin.settings.elevenLabsApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ElevenLabs Voice ID')
			.setDesc('사용할 목소리의 Voice ID')
			.addText(text => text
				.setPlaceholder('예: 21m00Tcm4TlvDq8ikWAM')
				.setValue(this.plugin.settings.elevenLabsVoiceId)
				.onChange(async (value) => {
					this.plugin.settings.elevenLabsVoiceId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Google Drive Access Token')
			.setDesc('오디오 파일 업로드를 위한 Google OAuth Access Token (Bearer 제외)')
			.addText(text => text
				.setPlaceholder('ya29.a0...')
				.setValue(this.plugin.settings.googleAccessToken)
				.onChange(async (value) => {
					this.plugin.settings.googleAccessToken = value;
					await this.plugin.saveSettings();
				}));
	}
}