/**
 * ============================================================
 * 实验流程控制器 v6.0 — 多故事支持
 * ============================================================
 * 流程: 知情同意 → 麦克风测试 → 被试编号 → 影院
 * 影院内: Scenario1 → Q1 → Scenario2 → ... → Q9 → 语音 → Scenario10 → 故事完成/下一故事
 * 命名规则:
 *   视频: assets/video/{storyId}/Scenario1.mp4 ~ Scenario10.mp4
 *   问题语音: assets/audio/{storyId}/q1.mp3 ~ qN.mp3 (仅前 N 题)
 *   选项语音: assets/audio/{storyId}/{qNum}_{optNum}.mp3  (1_1 ~ 9_3)
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

  // 多故事状态
  _currentStoryIndex: 0,
  _currentStory: null,
  _storyDataAccumulator: [],  // 累积各故事数据

  // Galgame 状态
  _galgameQuestionActive: false,
  _galgameOptionSelected: null,
  _galgameAudioPlaying: false,
  _galgameCurrentAudio: null,
  _galgameQuestionAudioTimeout: null,
  _galgameConfirmVisible: false,

  init() {
    DataCollector.reset();
    this._bindEvents();
    this._checkBrowser();

    if (EXPERIMENT_CONFIG.experiment.debugMode) {
      DataCollector.setConsent();
      DataCollector.setSubjectId('DEBUG_' + Date.now().toString(36));
      this.micTestRecorder = new AudioRecorder({ manualMode: true, maxDuration: 30000 });
      this.micTestRecorder.requestPermission().then(() => {
        this._showStoryPicker();
      });
    } else {
      this._showStage(0);
    }
  },

  _checkBrowser() {
    const tr = new AudioRecorder({ maxDuration: 1000 });
    if (!tr.isSupported) {
      this._showModal('您的浏览器不支持录音功能，请使用最新版 Chrome、Edge 或 Firefox。');
    }
  },

  // ==================== 故事选择器 ====================

  /**
   * 显示故事选择器（调试/测试用）
   */
  _showStoryPicker() {
    const enabledStories = EXPERIMENT_CONFIG.stories.filter(s => s.enabled);
    if (enabledStories.length === 1) {
      this._startStory(0);
      return;
    }

    // 隐藏主容器，显示影院覆盖层
    document.getElementById('progressBar').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'none';
    const overlay = document.getElementById('cinemaOverlay');
    overlay.style.display = 'block';
    requestAnimationFrame(() => overlay.classList.add('active'));
    document.getElementById('cinemaVideo').style.display = 'none';
    document.getElementById('cinemaControls').classList.remove('visible');

    const panel = document.getElementById('storyPicker');
    const list = document.getElementById('storyPickerList');
    list.innerHTML = '';

    enabledStories.forEach((story, idx) => {
      const btn = document.createElement('button');
      btn.className = 'story-pick-btn';
      btn.innerHTML = `
        <span class="story-pick-num">${idx + 1}</span>
        <span class="story-pick-name">${story.name}</span>
      `;
      btn.addEventListener('click', () => {
        panel.style.display = 'none';
        document.getElementById('cinemaVideo').style.display = 'block';
        this._startStory(idx);
      });
      list.appendChild(btn);
    });

    panel.style.display = 'flex';
  },

  /**
   * 从指定索引开始一个故事
   */
  _startStory(storyIndex) {
    const enabledStories = EXPERIMENT_CONFIG.stories.filter(s => s.enabled);
    if (storyIndex >= enabledStories.length) {
      this._exitCinema(true);
      return;
    }
    const story = enabledStories[storyIndex];
    this._currentStoryIndex = storyIndex;
    this._currentStory = story;
    this._storyDataAccumulator = [];

    // 隐藏故事选择器和过渡面板
    document.getElementById('storyPicker').style.display = 'none';
    this._hideGalgameUI();
    this._hideOverlay('voice');
    this._hideOverlay('storyComplete');

    document.getElementById('cinemaVideo').style.display = 'block';

    this._enterCinema(story);
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
      this._startStory(0);
    });

    // ---- 视频控制 ----
    document.getElementById('btnCinemaToggle').addEventListener('click', () => this._toggleVideoPlay());
    document.getElementById('btnCinemaBack').addEventListener('click', () => this._seekVideo(-10));
    document.getElementById('btnCinemaFwd').addEventListener('click', () => this._seekVideo(10));

    // ---- 影院：语音录制 ----
    document.getElementById('btnCinemaRecord').addEventListener('click', () => {
      if (!this.voiceRecorder) return;
      if (this.voiceRecorder.isRecording) {
        this.voiceRecorder.stop();
      } else {
        this.voiceRecorder.start();
      }
    });

    document.getElementById('btnCinemaVoiceOK').addEventListener('click', () => {
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

    document.getElementById('btnCinemaVoiceRetry').addEventListener('click', () => this._resetCinemaVoice());

    document.getElementById('btnCinemaBackToChoice').addEventListener('click', () => {
      this._hideOverlay('voice');
      if (this.voiceRecorder) this.voiceRecorder.destroy();
      this.voiceAudio = null;
      this._showOverlay('choice');
    });

    // ---- 故事过渡按钮 ----
    document.getElementById('btnNextStory').addEventListener('click', () => {
      this._hideOverlay('storyComplete');
      this._startStory(this._currentStoryIndex + 1);
    });
    document.getElementById('btnReplayStory').addEventListener('click', () => {
      this._hideOverlay('storyComplete');
      this._startStory(this._currentStoryIndex);
    });
    document.getElementById('btnExitExperiment').addEventListener('click', () => {
      this._hideOverlay('storyComplete');
      this._exitCinema(true);
    });
    document.getElementById('btnStoryPicker').addEventListener('click', () => {
      this._hideOverlay('storyComplete');
      this._showStoryPicker();
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
      case 'cinema': this._enterCinema(EXPERIMENT_CONFIG.stories[0]); break;
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

  /**
   * 根据故事配置进入影院模式
   */
  _enterCinema(story) {
    const overlay = document.getElementById('cinemaOverlay');
    const video = document.getElementById('cinemaVideo');
    const totalVideos = story.questions.length + 1;

    // 构建视频序列
    this._videoSequence = [];
    for (let i = 1; i <= totalVideos; i++) {
      this._videoSequence.push(`${story.videoFolder}/Scenario${i}.mp4`);
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

    document.getElementById('cinemaControls').classList.add('visible');
    this._hideGalgameUI();

    // 加载第一个视频
    this._loadVideoByIndex(0);
    this._bindVideoEnded();
  },

  /**
   * 加载并播放序列中的视频
   */
  _loadVideoByIndex(index) {
    const video = document.getElementById('cinemaVideo');
    const src = this._videoSequence[index];

    video.style.display = 'block';

    if (!src || index >= this._videoSequence.length) {
      console.warn('[Galgame] 视频路径为空，尝试回退');
      this._videoPlaying = false;
      if (index < this._videoSequence.length - 1) {
        this._galgameQuestionActive = true;
        this._currentQuestionIndex = index;
        this._renderGalgameQuestion();
      } else {
        this._onStoryVideoComplete();
      }
      return;
    }

    this._videoIndex = index;
    this._videoPlaying = true;

    video.src = src;
    video.load();
    video.play().catch(e => {
      console.warn('[Galgame] 自动播放失败:', e.message, ' 路径:', src);
      // 视频加载失败不阻塞流程
    });

    document.getElementById('btnCinemaSkip').style.display =
      EXPERIMENT_CONFIG.experiment.showSkipButton ? 'block' : 'none';
  },

  /**
   * 绑定视频结束事件
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
        // 最终视频 → 故事完成
        this._onStoryVideoComplete();
      }
    };

    video.onerror = () => {
      console.warn('[Galgame] 视频加载失败:', video.src);
      this._videoPlaying = false;
      if (this._videoIndex < this._videoSequence.length - 1) {
        this._galgameQuestionActive = true;
        this._currentQuestionIndex = this._videoIndex;
        this._renderGalgameQuestion();
      } else {
        this._onStoryVideoComplete();
      }
    };
  },

  /**
   * 播放下一个视频（选题+语音完成后调用）
   */
  _playNextVideo() {
    this._hideGalgameUI();
    const nextIdx = this._videoIndex + 1;
    if (nextIdx < this._videoSequence.length) {
      this._loadVideoByIndex(nextIdx);
      this._bindVideoEnded();
    } else {
      this._onStoryVideoComplete();
    }
  },

  /**
   * 故事所有视频播放完毕
   */
  _onStoryVideoComplete() {
    this._showGalgameCompleteToast();
    setTimeout(() => this._showStoryComplete(), 1800);
  },

  /**
   * 故事完成 → 显示过渡面板
   */
  _showStoryComplete() {
    const story = this._currentStory;
    const enabledStories = EXPERIMENT_CONFIG.stories.filter(s => s.enabled);
    const hasNext = this._currentStoryIndex + 1 < enabledStories.length;

    document.getElementById('storyCompleteName').textContent = story.name;
    document.getElementById('btnNextStory').style.display = hasNext ? 'inline-flex' : 'none';
    document.getElementById('storyCompleteNextHint').style.display = hasNext ? 'block' : 'none';

    document.getElementById('cinemaVideo').style.display = 'none';
    this._hideGalgameUI();
    this._showOverlay('storyComplete');
  },

  _exitCinema(toComplete) {
    this._stopGalgameAudio();
    const overlay = document.getElementById('cinemaOverlay');
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
      document.getElementById('cinemaVideo').pause();
      document.getElementById('cinemaVideo').onended = null;
      document.getElementById('cinemaVideo').style.display = 'block';
      document.getElementById('cinemaControls').classList.remove('visible');
      document.getElementById('progressBar').style.display = 'block';
      document.getElementById('mainContainer').style.display = 'block';
      this._hideGalgameUI();
      this._hideAllOverlays();
      if (toComplete) {
        this._showStage(4);
      }
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
    if (!video.duration || !isFinite(video.duration)) return;
    const target = video.currentTime + seconds;
    video.currentTime = Math.max(0, Math.min(video.duration, target));
  },

  // ==================== Galgame UI 控制 ====================

  _hideGalgameUI() {
    document.getElementById('galgameDialogArea').style.display = 'none';
    document.getElementById('galgameOptionsPanel').style.display = 'none';
    this._hideChoiceVeil();
    this._stopGalgameAudio();
  },

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
   * 格式: {audioFolder}/{qNum}-{optNum}.{ext}
   *   qNum = 题号(1-based), optNum = 选项编号(1=A, 2=B, 3=C)
   *   例如: assets/audio/diningHall/1-1.mp3（第1题A选项）
   */
  _getOptionAudioPath(questionId, optionValue) {
    const story = this._currentStory;
    const optNum = optionValue === 'A' ? 1 : optionValue === 'B' ? 2 : 3;
    const qNum = parseInt(questionId.replace('q', ''));
    return `${story.audioFolder}/${qNum}-${optNum}.${story.audioExt}`;
  },

  _showChoiceVeil() {
    const veil = document.getElementById('choiceVeil');
    if (!veil) return;
    veil.style.display = 'block';
    requestAnimationFrame(() => veil.classList.add('visible'));
  },

  _hideChoiceVeil() {
    const veil = document.getElementById('choiceVeil');
    if (!veil) return;
    veil.classList.remove('visible');
    setTimeout(() => {
      if (!veil.classList.contains('visible')) veil.style.display = 'none';
    }, 500);
  },

  _showGalgameCompleteToast() {
    const toast = document.getElementById('cinemaCompleteOverlay');
    toast.style.display = 'block';
    requestAnimationFrame(() => toast.classList.add('visible'));
  },

  // ==================== Galgame 提问流程 ====================

  _renderGalgameQuestion() {
    const story = this._currentStory;
    const questions = story.questions;
    const q = questions[this._currentQuestionIndex];
    if (!q) {
      this._collectCinemaChoices();
      this._choicesSubmitted = true;
      this._hideGalgameUI();
      this._showOverlay('voice');
      return;
    }

    this._stopGalgameAudio();
    this._galgameOptionSelected = null;
    this._galgameConfirmVisible = false;

    document.getElementById('galgameDialogArea').style.display = 'block';
    document.getElementById('galgameOptionsPanel').style.display = 'none';
    this._showChoiceVeil();

    // 前 N 题播放问题语音
    if (this._currentQuestionIndex < story.questionAudioCount) {
      const audioPath = `${story.audioFolder}/q${this._currentQuestionIndex + 1}.${story.audioExt}`;
      this._playQuestionAudioAndShowOptions(q, audioPath);
    } else {
      this._showGalgameOptions(q);
    }
  },

  _playQuestionAudioAndShowOptions(question, audioPath) {
    this._galgameAudioPlaying = true;

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    this._galgameCurrentAudio = audio;

    audio.play().catch(e => {
      console.warn('[Galgame] 问题音频播放失败:', e.message, ' 路径:', audioPath);
      this._stopGalgameAudio();
      this._showGalgameOptions(question);
    });

    audio.onended = () => {
      this._stopGalgameAudio();
      this._showGalgameOptions(question);
    };

    this._galgameQuestionAudioTimeout = setTimeout(() => {
      if (this._galgameCurrentAudio === audio && this._galgameAudioPlaying) {
        try { audio.pause(); } catch(e) {}
        this._stopGalgameAudio();
        this._showGalgameOptions(question);
      }
    }, 15000);
  },

  _showGalgameOptions(question) {
    const panel = document.getElementById('galgameOptionsPanel');
    const list = document.getElementById('galgameOptionsList');

    list.innerHTML = '';
    panel.style.display = 'block';

    panel.style.animation = 'none';
    void panel.offsetHeight;
    panel.style.animation = '';

    question.options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'galgame-option-btn';
      btn.dataset.q = question.id;
      btn.dataset.v = opt.value;
      btn.style.animationDelay = `${index * 0.1}s`;

      btn.innerHTML = `
        <span class="option-letter-badge">${opt.value}</span>
        <span class="option-text-content">
          <span class="option-label-line">${opt.label}</span>
        </span>
      `;

      btn.addEventListener('click', () => this._onGalgameOptionClick(question, opt, btn));
      list.appendChild(btn);
    });
  },

  _onGalgameOptionClick(question, option, btnElement) {
    const isSameOption = this._galgameOptionSelected &&
      this._galgameOptionSelected.optionValue === option.value &&
      this._galgameOptionSelected.questionId === question.id;

    if (this._galgameAudioPlaying && isSameOption) return;

    if (this._galgameAudioPlaying) {
      this._stopGalgameAudio();
    }

    document.querySelectorAll('.option-confirm-btn').forEach(b => b.remove());
    this._galgameConfirmVisible = false;
    document.querySelectorAll('.galgame-option-btn').forEach(b => b.classList.remove('selected', 'audio-playing'));
    btnElement.classList.add('selected');

    this._galgameOptionSelected = {
      questionId: question.id,
      questionStem: question.stem,
      optionValue: option.value,
      optionLabel: option.label,
      storyId: this._currentStory.id,
    };

    this._choiceAnswers[question.id] = this._galgameOptionSelected;

    const audioPath = this._getOptionAudioPath(question.id, option.value);
    if (audioPath) {
      this._playOptionAudioAndShowConfirm(audioPath, btnElement);
    } else {
      this._showConfirmButton(btnElement);
    }
  },

  _playOptionAudioAndShowConfirm(audioPath, btnElement) {
    this._galgameAudioPlaying = true;
    btnElement.classList.add('audio-playing');

    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    this._galgameCurrentAudio = audio;

    audio.play().catch(e => {
      console.warn('[Galgame] 选项音频播放失败:', e.message, ' 路径:', audioPath);
      this._galgameAudioPlaying = false;
      this._galgameCurrentAudio = null;
      btnElement.classList.remove('audio-playing');
      this._showConfirmButton(btnElement);
    });

    audio.onended = () => {
      this._galgameAudioPlaying = false;
      this._galgameCurrentAudio = null;
      btnElement.classList.remove('audio-playing');
      this._showConfirmButton(btnElement);
    };
  },

  _showConfirmButton(btnElement) {
    if (this._galgameConfirmVisible) return;
    this._galgameConfirmVisible = true;

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

  _advanceGalgameQuestion() {
    const questions = this._currentStory.questions;
    this._currentQuestionIndex += 1;

    if (this._currentQuestionIndex < questions.length) {
      this._hideGalgameUI();
      this._loadVideoByIndex(this._currentQuestionIndex);
      this._bindVideoEnded();
    } else {
      this._collectCinemaChoices();
      this._choicesSubmitted = true;
      this._hideGalgameUI();
      this._showOverlay('voice');
    }
  },

  _collectCinemaChoices() {
    const results = this._currentStory.questions.map(q => (
      this._choiceAnswers[q.id] || {
        questionId: q.id,
        questionStem: q.stem,
        selectedValue: null,
        selectedLabel: null,
      }
    ));
    // 添加故事ID
    const storyData = {
      storyId: this._currentStory.id,
      storyName: this._currentStory.name,
      choices: results,
    };
    DataCollector.appendStoryData(storyData);
  },

  // ==================== 浮层 ====================

  _showOverlay(name) {
    if (name === 'voice' || name === 'storyComplete') {
      const el = document.getElementById(name === 'voice' ? 'voiceOverlay' : 'storyCompleteOverlay');
      if (el) {
        el.style.display = 'flex';
        requestAnimationFrame(() => el.classList.add('visible'));
      }
    }
    if (name === 'voice') {
      this._initCinemaVoice();
    }
  },

  _hideOverlay(name) {
    const id = name === 'voice' ? 'voiceOverlay' : name === 'storyComplete' ? 'storyCompleteOverlay' : name + 'Overlay';
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('visible');
      setTimeout(() => { el.style.display = 'none'; }, 500);
    }
  },

  _hideAllOverlays() {
    ['voice', 'storyComplete'].forEach(name => this._hideOverlay(name));
  },

  // ==================== 语音录制 ====================

  _initCinemaVoice() {
    document.getElementById('cinemaVoiceQuestion').textContent =
      this._currentStory.voiceQuestion;

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

    if (this.micTestRecorder?.stream) {
      this.voiceRecorder.stream = this.micTestRecorder.stream;
      this.voiceRecorder.micPermission = 'granted';
      this.voiceRecorder.isSupported = true;
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
      this._galgameQuestionActive = false;
      this._stopGalgameAudio();
      this._collectCinemaChoices();
      this._choicesSubmitted = true;
      this._hideGalgameUI();
      this._showOverlay('voice');
    } else {
      video.pause();
      this._videoPlaying = false;
      DataCollector.logVideoWatched();
      if (this._videoIndex < this._videoSequence.length - 1) {
        this._galgameQuestionActive = true;
        this._currentQuestionIndex = this._videoIndex;
        this._renderGalgameQuestion();
      } else {
        this._onStoryVideoComplete();
      }
    }
  },

  // ==================== 完成页 ====================

  async _handleComplete() {
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
