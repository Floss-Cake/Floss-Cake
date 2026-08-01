/**
 * ============================================================
 * 心理学实验平台 - 入口文件
 * ============================================================
 */

(function () {
  'use strict';

  // 页面加载完成后初始化实验
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { Experiment.init(); bindAdminEntry(); });
  } else {
    Experiment.init();
    bindAdminEntry();
  }

  /**
   * 绑定实验页左上角「进入管理平台」标签：
   * 点击 → 弹出全屏浮层并加载 admin/index.html（管理平台自带登录门禁）。
   * 不进入管理平台时，实验流程照常进行。
   */
  function bindAdminEntry() {
    const badge = document.getElementById('adminEntryBadge');
    const overlay = document.getElementById('adminEmbedOverlay');
    const frame = document.getElementById('adminEmbedFrame');
    const closeBtn = document.getElementById('adminEmbedClose');
    if (!badge || !overlay || !frame) return;

    let loaded = false;
    const open = () => {
      // 仅在首次打开时加载管理平台，避免无谓请求
      if (!loaded) {
        frame.src = 'admin/index.html';
        loaded = true;
      }
      overlay.style.display = 'flex';
      document.body.classList.add('admin-embed-open');
      const hint = document.getElementById('adminEmbedLoading');
      if (hint) hint.style.display = 'flex';
      frame.onload = () => { if (hint) hint.style.display = 'none'; };
    };
    const close = () => {
      overlay.style.display = 'none';
      document.body.classList.remove('admin-embed-open');
    };

    badge.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    // 按 Esc 关闭浮层
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display !== 'none') close();
    });
  }

  // 页面关闭前保存数据
  window.addEventListener('beforeunload', (e) => {
    // 如果实验进行中，提醒用户
    if (Experiment.currentStage > 0 && Experiment.currentStage < 4) {
      // 自动保存当前数据
      const pkg = DataCollector.getPackage();
      StorageManager.save('interrupted', pkg);
    }
  });

  // 检测用户尝试离开页面
  window.addEventListener('pagehide', () => {
    if (Experiment.currentStage > 0 && Experiment.currentStage < 4) {
      const pkg = DataCollector.getPackage();
      StorageManager.save('interrupted', pkg);
    }
  });

  console.log('%c🧪 心理学实验平台已就绪 %cv' + EXPERIMENT_CONFIG.experiment.version,
    'font-size:16px;', 'color:#999;');
  console.log('%c后端类型: %c' + EXPERIMENT_CONFIG.backend.type.toUpperCase(),
    '', 'color:#4CAF50;');
  console.log('%c会话ID: %c' + DataCollector.session.sessionId,
    '', 'color:#2196F3;');
})();
