/**
 * ============================================================
 * 数据采集模块 v2.0 - 多故事支持
 * ============================================================
 */

const DataCollector = {
  session: {
    sessionId: StorageManager.generateSessionId(),
    subjectId: '',
    consentTime: null,
    experimentStartTime: null,

    micTest: null,
    choices: [],          // 兼容旧格式
    storiesData: [],      // 多故事数据累积 [{storyId, storyName, choices, voiceAnswer}]
    voiceAnswer: null,    // 最新声音回答
    textInput: '',

    events: [],
  },

  reset() {
    this.session = {
      sessionId: StorageManager.generateSessionId(),
      subjectId: '',
      consentTime: null,
      experimentStartTime: null,
      micTest: null,
      choices: [],
      storiesData: [],
      voiceAnswer: null,
      textInput: '',
      events: [],
    };
  },

  logEvent(eventName, data = {}) {
    this.session.events.push({
      event: eventName,
      timestamp: new Date().toISOString(),
      data,
    });
  },

  setConsent() {
    this.session.consentTime = new Date().toISOString();
    this.logEvent('consent_given');
    StorageManager.save('sessionId', this.session.sessionId);
  },

  setSubjectId(id) {
    this.session.subjectId = id;
    this.session.experimentStartTime = new Date().toISOString();
    this.logEvent('experiment_started', { subjectId: id });
    StorageManager.save('subjectId', id);
  },

  setMicTest(testData) {
    this.session.micTest = {
      passed: testData.passed,
      audioBase64: testData.audioBase64 || null,
      audioSize: testData.audioSize || 0,
      duration: testData.duration || 0,
      timestamp: new Date().toISOString(),
    };
    this.logEvent('mic_test_completed', { passed: testData.passed, duration: testData.duration });
  },

  logVideoWatched() {
    this.logEvent('video_watched');
  },

  logVideoSkipped() {
    this.logEvent('video_skipped');
  },

  setChoices(choices) {
    this.session.choices = choices;
    this.logEvent('choices_submitted', { count: choices.length });
  },

  /**
   * 追加一个故事的完整数据
   * @param {object} storyData  {storyId, storyName, choices}
   */
  appendStoryData(storyData) {
    this.session.storiesData.push({
      storyId: storyData.storyId,
      storyName: storyData.storyName,
      choices: storyData.choices,
      timestamp: new Date().toISOString(),
    });
    // 同时更新 choices 兼容旧格式
    this.session.choices = this.session.choices.concat(
      storyData.choices.map(c => ({ ...c, storyId: storyData.storyId }))
    );
    this.logEvent('story_completed', { storyId: storyData.storyId, choiceCount: storyData.choices.length });
  },

  setVoiceAnswer(voiceData) {
    this.session.voiceAnswer = {
      audioBase64: voiceData.audioBase64 || null,
      audioSize: voiceData.audioSize || 0,
      duration: voiceData.duration || 0,
      timestamp: new Date().toISOString(),
    };
    this.logEvent('voice_answer_recorded');
  },

  getPackage() {
    // 获取当前故事信息
    const currentStoryData = this.session.storiesData.length > 0 
      ? this.session.storiesData[this.session.storiesData.length - 1] 
      : null;

    return StorageManager.createDataPackage({
      sessionId: this.session.sessionId,
      subjectId: this.session.subjectId,
      consentTime: this.session.consentTime,
      experimentStartTime: this.session.experimentStartTime,
      micTest: this.session.micTest,
      choices: this.session.choices,
      storiesData: this.session.storiesData,
      voiceAnswer: this.session.voiceAnswer,
      textInput: this.session.textInput,
      events: this.session.events,
      // 当前故事上下文
      storyId: currentStoryData ? currentStoryData.storyId : '',
      storyName: currentStoryData ? currentStoryData.storyName : '',
    });
  },

  download() {
    const pkg = this.getPackage();
    const filename = `experiment-${this.session.subjectId}-${this.session.sessionId}.json`;
    StorageManager.downloadJSON(pkg, filename);
  },

  async upload() {
    const pkg = this.getPackage();
    return StorageManager.upload(pkg);
  },
};
