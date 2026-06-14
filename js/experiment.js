/**
 * ============================================================
 * 实验流程控制器 v5.0 - 简洁选项模式
 * ============================================================
 * 流程: 知情同意 → 麦克风测试 → 被试编号 → 影院
 * 影院内: scenario1 → Q1 → scenario2 → Q2 → ... → Qn → 语音 → 最终视频 → 完成
 * 每两个问题之间播放衔接剧情视频（视频命名: scenarioX.mp4）
 * 选项模式: 视频结束后直接浮现3个选项按钮
 * ============================================================
 */

const Experiment = {
  currentStage: 0,
  stages: ['consent', 'mic-test', 'subject-id', 'cinema', 'complete'],

  micTestRecorder: null,
  voiceRecorder: null,
  micTestAudio: null,
  voiceAudio: null,

  // 视频状态
  _videoIndex: 0,
  _videoSequence: [],
  _videoPlaying: true,
  _choicesSubmitted: false,
  _currentQuestionIndex: 0,
  _choiceAnswers: {},

  // Galgame 状态
  _galgameQuestionActive: false,
  _galgameOptionSelected: null,   // { optionValue, optionLabel, optionAudio }
  _galgameAudioPlaying: false,
  _galgameCurrentAudio: null,     // 当前播放的 Audio 实例
  _galgameQuestionAudioTimeout: null,
  _galgameConfirmVisible: false,

  init() {
    DataCollector.reset();
    this._bindEvents();
    this._checkBrowser();

    if (EXPERIMENT_CONFIG.experiment.debugMode) {
      // 调试模式：跳过伦理、麦克风、被试编号，直接进影院
      DataCollector.setConsent();
      DataCollector.setSubjectId('DEBUG_' + Date.now().toString(36));
      // 静默获取麦克风权限（影院内语音录制需要）
      this.micTestRecorder = new AudioRecorder({ manualMode: true, maxDuration: 30000 });
      this.micTestRecorder.requestPermission().then(() => {
        this._showStage(3);
      });
    } else {
      this._showStage(0);  // 正常流程：知情同意开始
    }
  },

  _checkBrowser() {
    const tr = new AudioRecorder({ maxDuration: 1000 });
    if (!tr.isSupported) {
      this._showModal('您的浏览器不支持录音功能，请使用最新版 Chrome、Edge 或 Firefox。');
    }
  },

  // ==================== 事件绑定 ====================

  _bindEvents() {
    // ---- 知情同意 ----
    const cb = document.getElementById('consentCheckbox');
    cb.addEventListener('change', () => {
      const ok = cb.checked;
      document.getElementById('btnConsentNext').disabled = !ok;
      document.getElementById('consentHint').style.display = ok ? 'none' : 'block';
    });
    document.getElementById('btnConsentNext').addEventListener('click', () => {
      DataCollector.setConsent();
      this._showStage(1);
    });

    // ---- 麦克风测试 ----
    document.getElementById('btnStartRecord').addEventListener('click', () => {
      if (!this.micTestRecorder) return;
      if (this.micTestRecorder.isRecording) {
        this.micTestRecorder.stop();
      } else {
        this.micTestRecorder.start();
      }
    });
    document.getElementById('btnMicOK').addEventListener('click', () => this._showStage(2));
    document.getElementById('btnMicRetry').addEventListener('click', () => this._resetMicTest());
    document.getElementById('btnDownloadMicTest').addEventListener('click', () => {
      if (this.micTestAudio?.blob) this._downloadBlob(this.micTestAudio.blob, 'mic-test.webm');
    });

    // ---- 被试编号 ----
    const subj = document.getElementById('subjectId');
    subj.addEventListener('input', () => {
      document.getElementById('btnStartExperiment').disabled = !subj.value.trim();
    });
    document.getElementById('btnStartExperiment').addEventListener('click', () => {
      DataCollector.setSubjectId(subj.value.trim());
      this._showStage(3);
    });

    // ---- 视频控制 ----
    document.getElementById('btnCinemaToggle').addEventListener('click', () => this._toggleVideoPlay());
    document.getElementById('btnCinemaBack').addEventListener('click', () => this._seekVideo(-10));
    document.getElementById('btnCinemaFwd').addEventListener('click', () => this._seekVideo(10));

    // ---- 影院：选题提交（Galgame 模式下不再使用全局提交按钮） ----
    // 确认逻辑已移至每个选项的独立确认按钮 (_advanceGalgameQuestion)

    // ---- 影院：语音录制 ----
    document.getElementById('btnCinemaRecord').addEventListener('click', () => {
      if (!this.voiceRecorder) return;
      if (this.voiceRecorder.isRecording) {
        this.voiceRecorder.stop();
      } else {
        this.voiceRecorder.start();
      }
    });

    // 确认语音 → 播放 scenario2
    document.getElementById('btnCinemaVoiceOK').addEventListener('click', () => {
      // 保存语音数据
      if (this.voiceAudio) {
        const dur = this.voiceAudio.duration || 0;
        DataCollector.setVoiceAnswer({
          audioSize: this.voiceAudio.blob.size,
          duration: dur,
        });
      }
      this._hideOverlay('voice');
      this._playNextVideo();
    });

    // 重新录制
    document.getElementById('btnCinemaVoiceRetry').addEventListener('click', () => this._resetCinemaVoice());

    // 退回修改选项
    document.getElementById('btnCinemaBackToChoice').addEventListener('click', () => {
      this._hideOverlay('voice');
      if (this.voiceRecorder) this.voiceRecorder.destroy();
      this.voiceAudio = null;
      this._showOverlay('choice');
    });

    // ---- 完成页 ----
    document.getElementById('btnDownloadData').addEventListener('click', () => DataCollector.download());
    document.getElementById('btnDownloadVoiceAudio').addEventListener('click', () => {
      if (this.voiceAudio?.blob) this._downloadBlob(this.voiceAudio.blob, `voice-${DataCollector.session.subjectId}.webm`);
    });
    document.getElementById('btnDownloadMicAudio').addEventListener('click', () => {
      if (this.micTestAudio?.blob) this._downloadBlob(this.micTestAudio.blob, `mic-test-${DataCollector.session.subjectId}.webm`);
    });

    // ---- 模态弹窗 ----
    document.getElementById('btnModalClose').addEventListener('click', () => {
      document.getElementById('modalOverlay').style.display = 'none';
    });

    // ---- 影院跳过 ----
    document.getElementById('btnCinemaSkip').addEventListener('click', () => this._skipCinemaCurrent());
  },

  // ==================== 阶段切换 ====================

  _showStage(index) {
    document.querySelectorAll('.stage').forEach(el => el.classList.remove('active'));
    const stageId = this.stages[index];
    const el = document.getElementById(`stage-${stageId}`);
    if (el) el.classList.add('active');
    this._updateProgress(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.currentStage = index;
    this._onStageEnter(stageId);
  },

  _updateProgress(index) {
    const total = this.stages.length - 1;
    const pct = Math.round((index / total) * 100);
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('progressText').textContent = `步骤 ${index}/${total}`;
  },

  _onStageEnter(stageId) {
    switch (stageId) {
      case 'mic-test': this._initMicTest(); break;
      case 'cinema': this._enterCinema(); break;
      case 'complete': this._handleComplete(); break;
    }
  },

  // ==================== 麦克风测试 ====================

  async _initMicTest() {
    const se = document.getElementById('micStatus');
    const st = document.getElementById('micStatusText');
    const btn = document.getElementById('btnStartRecord');
    se.className = 'mic-status'; st.textContent = '正在请求麦克风权限...';

    this.micTestRecorder = new AudioRecorder({
      manualMode: true,
      maxDuration: 30000,
      onTick: (sec) => {
        document.getElementById('recordTimer').textContent = `00:${String(sec).padStart(2, '0')}`;
      },
      onStart: () => {
        btn.classList.add('recording');
        btn.innerHTML = '<span class="record-dot"></span> 点击停止录音';
        st.textContent = '正在录音，请对着麦克风说话...';
      },
      onStop: (blob, url, dur) => {
        btn.classList.remove('recording');
        btn.innerHTML = '<span class="record-dot"></span> 开始录音';
        btn.disabled = false;
        document.getElementById('playbackSection').style.display = 'block';
        document.getElementById('audioPlayback').src = url;
        document.getElementById('micTestResult').style.display = 'flex';
        document.getElementById('btnDownloadMicTest').style.display = 'inline-flex';
        this.micTestAudio = { blob, url };
        DataCollector.setMicTest({ passed: true, audioSize: blob.size, duration: dur });
        st.textContent = `录音完成（${dur}秒），请播放确认。`;
      },
      onError: (err) => {
        st.textContent = err.message; se.className = 'mic-status denied';
        this._showModal(err.message);
      },
      onVisualizer: (data) => this._updateVisualizer('audioVisualizer', data),
    });

    const ok = await this.micTestRecorder.requestPermission();
    if (ok) {
      se.className = 'mic-status granted';
      st.textContent = '麦克风已就绪，点击按钮开始，再次点击停止';
      btn.disabled = false;
    } else {
      se.className = 'mic-status denied';
      st.textContent = '麦克风权限未授权，无法继续实验';
    }
  },

  _resetMicTest() {
    ['micTestResult','playbackSection'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    document.getElementById('audioPlayback').src = '';
    document.getElementById('btnDownloadMicTest').style.display = 'none';
    document.getElementById('recordTimer').textContent = '00:00';
    const btn = document.getElementById('btnStartRecord');
    btn.disabled = false; btn.classList.remove('recording');
    btn.innerHTML = '<span class="record-dot"></span> 开始录音';
    if (this.micTestRecorder) this.micTestRecorder.destroy();
    this.micTestAudio = null;
    this._initMicTest();
  },

  // ==================== 影院入口 ====================

  _enterCinema() {
    const overlay = document.getElementById('cinemaOverlay');
    const video = document.getElementById('cinemaVideo');
    const cfg = EXPERIMENT_CONFIG.scenario;

    // 初始化视频序列 — 根据题目数量动态生成
    // 格式：[scenario1(开场), scenario2(Q1→Q2过渡), scenario3(Q2→Q3过渡), ..., scenarioN(最终)]
    const totalVideos = cfg.questions.length + 1;
    for (let i = 1; i <= totalVideos; i++) {
      const key = `scenario${i}`;
      if (!cfg.videos[key]) {
        cfg.videos[key] = `assets/video/scenario${i}.mp4`;
      }
    }
    this._videoSequence = [];
    for (let i = 1; i <= totalVideos; i++) {
      this._videoSequence.push(`scenario${i}`);
    }
    this._videoIndex = 0;
    this._videoPlaying = true;
    this._choicesSubmitted = false;
    this._currentQuestionIndex = 0;
    this._choiceAnswers = {};

    // 初始化 Galgame 状态
    this._galgameQuestionActive = false;
    this._galgameOptionSelected = null;
    this._galgameAudioPlaying = false;
    this._galgameCurrentAudio = null;
    this._galgameConfirmVisible = false;

    // 隐藏进度条和主容器
    document.getElementById('progressBar').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'none';

    // 显示 Galgame 影院
    overlay.style.display = 'block';
    requestAnimationFrame(() => overlay.classList.add('active'));

    // 显示视频控制
    document.getElementById('cinemaControls').classList.add('visible');

    // 隐藏所有 UI 元素（初始只显示视频背景）
    this._hideGalgameUI();

    this._loadVideoByIndex(0);
    this._bindVideoEnded();
  },

  /**
   * 加载并播放序列中的视频
   */
  _loadVideoByIndex(index) {
    const video = document.getElementById('cinemaVideo');
    const cfg = EXPERIMENT_CONFIG.scenario;
    const key = this._videoSequence[index];
    const src = cfg.videos[key];
    if (!src) {
      console.warn('[Galgame] 视频未找到:', key);
      // 视频缺失时触发视频结束逻辑
      this._videoPlaying = false;
      if (index < this._videoSequence.length - 1) {
        this._galgameQuestionActive = true;
        this._currentQuestionIndex = index;
        this._renderGalgameQuestion();
      } else {
        this._showGalgameCompleteToast();
        setTimeout(() => this._exitCinema(), 1200);
      }
      return;
    }
    this._videoIndex = index;
    this._videoPlaying = true;

    video.src = src;
    video.load();
    video.play().catch(e => {
      console.warn('[Galgame] 自动播放失败:', e);
    });

    document.getElementById('btnCinemaSkip').style.display =
      EXPERIMENT_CONFIG.experiment.showSkipButton ? 'block' : 'none';
  },

  /**
   * 绑定视频结束事件
   * 首个视频(scenario1)结束 → 显示Q1
   * 过渡视频结束 → 显示对应题目
   * 最终视频结束 → 退出影院
   */
  _bindVideoEnded() {
    const video = document.getElementById('cinemaVideo');
    video.onended = null;
    
    video.onended = () => {
      this._videoPlaying = false;
      DataCollector.logVideoWatched();

      if (this._videoIndex < this._videoSequence.length - 1) {
        // 非最终视频 → 显示对应序号的问题
        this._galgameQuestionActive = true;
        this._currentQuestionIndex = this._videoIndex;
        this._renderGalgameQuestion();
      } else {
        // 最终视频 → 完成
        this._showGalgameCompleteToast();
        setTimeout(() => this._exitCinema(), 1800);
      }
    };

    video.onerror = () => {
      console.warn('[Galgame] 视频加载失败');
      this._videoPlaying = false;
      if (this._videoIndex < this._videoSequence.length - 1) {
        this._galgameQuestionActive = true;
        this._currentQuestionIndex = this._videoIndex;
        this._renderGalgameQuestion();
      } else {
        this._showGalgameCompleteToast();
        setTimeout(() => this._exitCinema(), 1200);
      }
    };
  },

  /**
   * 播放下一个视频（选题+语音完成后调用）
   */
  _playNextVideo() {
    // 隐藏所有 UI，进入纯视频模式
    this._hideGalgameUI();
    const nextIdx = this._videoIndex + 1;
    if (nextIdx < this._videoSequence.length) {
      this._loadVideoByIndex(nextIdx);
      this._bindVideoEnded();
    } else {
      this._exitCinema();
    }
  },

  _exitCinema() {
    // 清理 Galgame 音频
    this._stopGalgameAudio();
    const overlay = document.getElementById('cinemaOverlay');
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
      document.getElementById('cinemaVideo').pause();
      document.getElementById('cinemaVideo').onended = null;
      document.getElementById('cinemaControls').classList.remove('visible');
      document.getElementById('progressBar').style.display = 'block';
      document.getElementById('mainContainer').style.display = 'block';
      this._hideGalgameUI();
      this._showStage(4);
    }, 400);
  },

  // ==================== 视频控制 ====================

  _toggleVideoPlay() {
    const video = document.getElementById('cinemaVideo');
    if (video.paused) {
      video.play();
      this._videoPlaying = true;
    } else {
      video.pause();
      this._videoPlaying = false;
    }
  },

  _seekVideo(seconds) {
    const video = document.getElementById('cinemaVideo');
    // 确保视频时长有效再跳转，避免 currentTime 变成 NaN 导致重播
    if (!video.duration || !isFinite(video.duration)) return;
    const target = video.currentTime + seconds;
    video.currentTime = Math.max(0, Math.min(video.duration, target));
  },

  // ==================== Galgame UI 控制 ====================

  /**
   * 隐藏所有选项 UI 元素
   */
  _hideGalgameUI() {
    document.getElementById('galgameDialogArea').style.display = 'none';
    document.getElementById('galgameOptionsPanel').style.display = 'none';
    // 清理音频
    this._stopGalgameAudio();
  },

  /**
   * 停止当前音频
   */
  _stopGalgameAudio() {
    if (this._galgameCurrentAudio) {
      try { this._galgameCurrentAudio.pause(); } catch(e) {}
      this._galgameCurrentAudio.onended = null;
      this._galgameCurrentAudio = null;
    }
    if (this._galgameQuestionAudioTimeout) {
      clearTimeout(this._galgameQuestionAudioTimeout);
      this._galgameQuestionAudioTimeout = null;
    }
    this._galgameAudioPlaying = false;
    document.querySelectorAll('.galgame-option-btn').forEach(b => b.classList.remove('audio-playing'));
  },

  /**
   * 获取选项音频路径
   */
  _getOptionAudioPath(questionId, optionValue) {
    const key = `${questionId}_${optionValue}`;
    return EXPERIMENT_CONFIG.scenario.optionAudio[key] || null;
  },

  /**
   * 显示过渡提示
   */
  _showGalgameCompleteToast() {
    const toast = document.getElementById('cinemaCompleteOverlay');
    toast.style.display = 'block';
    requestAnimationFrame(() => toast.classList.add('visible'));
  },

  // ==================== Galgame 提问流程 ====================

  /**
   * 渲染当前问题 — 直接显示选项
   */
  _renderGalgameQuestion() {
    const questions = EXPERIMENT_CONFIG.scenario.questions;
    const q = questions[this._currentQuestionIndex];
    if (!q) {
      // 所有问题完成 → 进入语音环节
      this._collectCinemaChoices();
      this._choicesSubmitted = true;
      this._hideGalgameUI();
      this._showOverlay('voice');
      return;
    }

    // 清理之前状态
    this._stopGalgameAudio();
    this._galgameOptionSelected = null;
    this._galgameConfirmVisible = false;

    // 显示选项区域
    document.getElementById('galgameDialogArea').style.display = 'block';
    document.getElementById('galgameOptionsPanel').style.display = 'none';

    // 直接显示选项
    this._showGalgameOptions(q);
  },

  /**
   * 显示选项
   */
  _showGalgameOptions(question) {
    const panel = document.getElementById('galgameOptionsPanel');
    const list = document.getElementById('galgameOptionsList');

    list.innerHTML = '';
    panel.style.display = 'block';

    question.options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'galgame-option-btn';
      btn.dataset.q = question.id;
      btn.dataset.v = opt.value;
      btn.style.animationDelay = `${index * 0.1}s`;

      const hasAudio = !!this._getOptionAudioPath(question.id, opt.value);
      const audioLabel = hasAudio ? '' : ' (无音频)';

      btn.innerHTML = `
        <span class="option-letter-badge">${opt.value}</span>
        <span class="option-text-content">
          <span class="option-label-line">${opt.label}${audioLabel}</span>
        </span>
      `;

      btn.addEventListener('click', () => this._onGalgameOptionClick(question, opt, btn));
      list.appendChild(btn);
    });
  },

  /**
   * 选项点击
   * - 如果正在播放其他选项音频 → 停止当前音频，切换到新选项
   * - 如果正在播放同一选项音频 → 忽略（静待播放完成）
   * - 如果已显示确认按钮 → 允许切换到其他选项（重置确认状态）
   */
  _onGalgameOptionClick(question, option, btnElement) {
    // 如果正在播放同一选项音频，忽略
    const isSameOption = this._galgameOptionSelected &&
      this._galgameOptionSelected.optionValue === option.value &&
      this._galgameOptionSelected.questionId === question.id;

    if (this._galgameAudioPlaying && isSameOption) return;

    // 停止当前音频（如果正在播放）
    if (this._galgameAudioPlaying) {
      this._stopGalgameAudio();
    }

    // 移除之前选项的确认按钮
    document.querySelectorAll('.option-confirm-btn').forEach(b => b.remove());
    this._galgameConfirmVisible = false;

    // 取消之前的选择高亮
    document.querySelectorAll('.galgame-option-btn').forEach(b => b.classList.remove('selected', 'audio-playing'));
    btnElement.classList.add('selected');

    // 保存选择
    this._galgameOptionSelected = {
      questionId: question.id,
      questionStem: question.stem,
      optionValue: option.value,
      optionLabel: option.label,
    };

    // 记录到答案
    this._choiceAnswers[question.id] = this._galgameOptionSelected;

    // 播放选项音频
    const audioPath = this._getOptionAudioPath(question.id, option.value);
    if (audioPath) {
      this._playOptionAudioAndShowConfirm(audioPath, btnElement);
    } else {
      // 无音频，直接显示确认按钮
      this._showConfirmButton(btnElement);
    }
  },

  /**
   * 播放选项音频，播放完毕后显示确认按钮
   */
  _playOptionAudioAndShowConfirm(audioPath, btnElement) {
    this._galgameAudioPlaying = true;
    btnElement.classList.add('audio-playing');

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    this._galgameCurrentAudio = audio;

    audio.play().catch(e => {
      console.warn('[Galgame] 选项音频播放失败:', e.message);
      this._galgameAudioPlaying = false;
      this._galgameCurrentAudio = null;
      btnElement.classList.remove('audio-playing');
      // 失败也显示确认
      this._showConfirmButton(btnElement);
    });

    audio.onended = () => {
      this._galgameAudioPlaying = false;
      this._galgameCurrentAudio = null;
      btnElement.classList.remove('audio-playing');
      this._showConfirmButton(btnElement);
    };
  },

  /**
   * 在选项按钮右侧显示确认按钮
   */
  _showConfirmButton(btnElement) {
    if (this._galgameConfirmVisible) return;
    this._galgameConfirmVisible = true;

    // 移除已有的确认按钮
    const existing = btnElement.querySelector('.option-confirm-btn');
    if (existing) existing.remove();

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'option-confirm-btn';
    confirmBtn.type = 'button';
    confirmBtn.innerHTML = '确认 ✓';
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._advanceGalgameQuestion();
    });

    btnElement.appendChild(confirmBtn);
  },

  /**
   * 进入下一题或完成选择
   * 如果还有下一题 → 先播放过渡剧情视频
   * 所有题目完成 → 进入语音环节
   */
  _advanceGalgameQuestion() {
    const questions = EXPERIMENT_CONFIG.scenario.questions;
    this._currentQuestionIndex += 1;

    if (this._currentQuestionIndex < questions.length) {
      // 还有下一题 → 隐藏选项，播放过渡视频
      this._hideGalgameUI();
      // 过渡视频索引 = 当前已答完的题目数（也是下一题序号）
      // 例如：答完Q1（questionIdx=0→1），播放scenario2（videoIdx=1）
      this._loadVideoByIndex(this._currentQuestionIndex);
      this._bindVideoEnded();
    } else {
      // 所有问题完成 → 进入语音环节
      this._collectCinemaChoices();
      this._choicesSubmitted = true;
      this._hideGalgameUI();
      this._showOverlay('voice');
    }
  },

  _collectCinemaChoices() {
    const results = EXPERIMENT_CONFIG.scenario.questions.map(q => (
      this._choiceAnswers[q.id] || {
        questionId: q.id,
        questionStem: q.stem,
        selectedValue: null,
        selectedLabel: null,
      }
    ));
    DataCollector.setChoices(results);
  },

  // ==================== 浮层（兼容旧接口，实际只用于 voice） ====================

  _showOverlay(name) {
    this._hideAllOverlays();
    if (name === 'voice') {
      const el = document.getElementById('voiceOverlay');
      if (el) {
        el.style.display = 'flex';
        requestAnimationFrame(() => el.classList.add('visible'));
      }
      this._initCinemaVoice();
    }
  },

  _hideOverlay(name) {
    const el = document.getElementById(name + 'Overlay');
    if (el) {
      el.classList.remove('visible');
      setTimeout(() => { el.style.display = 'none'; }, 500);
    }
  },

  _hideAllOverlays() {
    ['voice'].forEach(name => {
      const el = document.getElementById(name + 'Overlay');
      if (el) { el.classList.remove('visible'); el.style.display = 'none'; }
    });
  },

  // ==================== 语音录制可视化 ====================

  _initCinemaVoice() {
    document.getElementById('cinemaVoiceQuestion').textContent =
      EXPERIMENT_CONFIG.scenario.voiceQuestion;

    const btn = document.getElementById('btnCinemaRecord');
    btn.disabled = false;
    btn.classList.remove('recording');
    btn.innerHTML = '<span class="record-dot"></span> 点击开始录音';
    document.getElementById('cinemaTimer').textContent = '00:00';
    document.getElementById('cinemaPlayback').style.display = 'none';
    document.getElementById('cinemaVoiceActions').style.display = 'none';

    this.voiceRecorder = new AudioRecorder({
      manualMode: true,
      maxDuration: 120000,
      onTick: (sec) => {
        document.getElementById('cinemaTimer').textContent = `00:${String(sec).padStart(2, '0')}`;
      },
      onStart: () => {
        btn.classList.add('recording');
        btn.innerHTML = '<span class="record-dot"></span> 录音中，点击停止';
      },
      onStop: (blob, url, dur) => {
        btn.classList.remove('recording');
        btn.innerHTML = '<span class="record-dot"></span> 点击开始录音';
        btn.disabled = false;
        document.getElementById('cinemaPlayback').style.display = 'block';
        document.getElementById('cinemaPlaybackAudio').src = url;
        document.getElementById('cinemaVoiceActions').style.display = 'flex';
        this.voiceAudio = { blob, url, duration: dur };
      },
      onError: (err) => this._showModal(err.message),
      onVisualizer: (data) => this._updateVisualizer('cinemaVisualizer', data),
    });

    // 复用已有 stream 并正确初始化 AudioContext/Analyser（修复可视化bug）
    if (this.micTestRecorder?.stream) {
      this.voiceRecorder.stream = this.micTestRecorder.stream;
      this.voiceRecorder.micPermission = 'granted';
      this.voiceRecorder.isSupported = true;
      // ★ 关键修复：从已有 stream 新建 AudioContext + Analyser
      this.voiceRecorder.initAnalyserFromStream();
    }
  },

  _resetCinemaVoice() {
    document.getElementById('cinemaPlayback').style.display = 'none';
    document.getElementById('cinemaVoiceActions').style.display = 'none';
    document.getElementById('cinemaPlaybackAudio').src = '';
    const btn = document.getElementById('btnCinemaRecord');
    btn.disabled = false; btn.classList.remove('recording');
    btn.innerHTML = '<span class="record-dot"></span> 点击开始录音';
    document.getElementById('cinemaTimer').textContent = '00:00';
    if (this.voiceRecorder) this.voiceRecorder.destroy();
    this.voiceAudio = null;
    this._initCinemaVoice();
  },

  _skipCinemaCurrent() {
    const voiceEl = document.getElementById('voiceOverlay');
    const dialogArea = document.getElementById('galgameDialogArea');
    const video = document.getElementById('cinemaVideo');
    
    const voiceVisible = voiceEl.style.display !== 'none' && voiceEl.classList.contains('visible');
    const dialogVisible = dialogArea.style.display !== 'none' && this._galgameQuestionActive;
    
    if (voiceVisible) {
      if (this.voiceRecorder?.isRecording) this.voiceRecorder.stop();
      this._hideOverlay('voice');
      this._playNextVideo();
    } else if (dialogVisible) {
      // 跳过当前问题 → 直接进入语音环节
      this._galgameQuestionActive = false;
      this._stopGalgameAudio();
      this._collectCinemaChoices();
      this._choicesSubmitted = true;
      this._hideGalgameUI();
      this._showOverlay('voice');
    } else {
      // 视频播放中 → 跳过视频
      video.pause();
      this._videoPlaying = false;
      DataCollector.logVideoWatched();
      if (this._videoIndex < this._videoSequence.length - 1) {
        this._galgameQuestionActive = true;
        this._currentQuestionIndex = this._videoIndex;
        this._renderGalgameQuestion();
      } else {
        this._showGalgameCompleteToast();
        setTimeout(() => this._exitCinema(), 1200);
      }
    }
  },

  // ==================== 完成页 ====================

  async _handleComplete() {
    // 语音数据已在 _initCinemaVoice → onStop 中通过 btnCinemaVoiceOK 保存
    const st = document.getElementById('uploadStatusText');
    const sp = document.getElementById('uploadSpinner');
    const re = document.getElementById('uploadResult');
    const dd = document.getElementById('dataDownload');

    st.textContent = '正在上传数据到服务器...'; sp.style.display = 'block';
    const result = await DataCollector.upload();
    sp.style.display = 'none'; re.style.display = 'block';

    if (result.success) {
      re.className = 'upload-result success';
      re.innerHTML = '<p>✅ 数据上传成功！感谢您的参与。</p>';
      st.textContent = '上传完成';
    } else if (result.local) {
      re.className = 'upload-result local';
      re.innerHTML = '<p>⚠️ 云端未配置，数据仅保存在本地。</p>';
      st.textContent = '本地存储模式';
    } else {
      re.className = 'upload-result error';
      re.innerHTML = `<p>❌ 上传失败：${result.error || '未知错误'}</p>`;
      st.textContent = '上传失败';
    }

    dd.style.display = 'block';
    document.getElementById('btnDownloadVoiceAudio').style.display =
      this.voiceAudio?.blob ? 'inline-flex' : 'none';
    document.getElementById('btnDownloadMicAudio').style.display =
      this.micTestAudio?.blob ? 'inline-flex' : 'none';
  },

  // ==================== 工具 ====================

  _updateVisualizer(containerId, dataArray) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const bars = c.querySelectorAll('.visualizer-bar');
    if (!bars.length) return;
    const step = Math.floor(dataArray.length / bars.length);
    bars.forEach((bar, i) => {
      bar.style.height = `${Math.max(2, (dataArray[i * step] || 0) / 255 * 100)}%`;
    });
  },

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  },

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  _showModal(msg) {
    document.getElementById('modalBody').innerHTML = msg;
    document.getElementById('modalOverlay').style.display = 'flex';
  },
};
