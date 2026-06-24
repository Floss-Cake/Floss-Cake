/**
 * ============================================================
 * 实验配置 - 后端接口和实验参数
 * ============================================================
 * 使用前请根据您的实际部署修改以下配置。
 * ============================================================
 */

const EXPERIMENT_CONFIG = {
  // ==========================================
  // 一、后端存储配置
  // ==========================================
  backend: {
    /**
     * 后端类型：'aliyun' | 'leancloud' | 'supabase' | 'local'
     * - aliyun: 阿里云 API Gateway + Function Compute
     * - leancloud: LeanCloud 云服务
     * - supabase: Supabase 开源云服务
     * - local: 仅本地下载（无需后端）
     */
    type: 'aliyun',

    // ---- 阿里云配置 ----
    aliyun: {
      /**
       * ★★★ 需要配置 ★★★
       * 阿里云 API Gateway 端点地址
       * 格式：https://your-api-id.apigateway.aliyuncs.com/your-stage/resource
       * 
       * 后端收到数据后的处理逻辑请参考 backend/aliyun-fc-template.js
       */
      apiEndpoint: 'https://YOUR_API_GATEWAY_ID.apigateway.aliyuncs.com/prod/experiment/upload',
      
      // API 鉴权（如使用阿里云APP签名认证）
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      
      // OSS 配置（用于存储音频文件）
      oss: {
        region: 'oss-cn-hangzhou',
        bucket: 'your-experiment-bucket',
        endpoint: 'https://your-experiment-bucket.oss-cn-hangzhou.aliyuncs.com',
        accessKeyId: 'YOUR_OSS_ACCESS_KEY_ID',
        accessKeySecret: 'YOUR_OSS_ACCESS_KEY_SECRET',
      },
    },

    // ---- LeanCloud 配置 ----
    leancloud: {
      appId: 'YOUR_LEANCLOUD_APP_ID',
      appKey: 'YOUR_LEANCLOUD_APP_KEY',
      serverURL: 'https://YOUR_APP_ID.api.lncldglobal.com',
    },

    // ---- Supabase 配置 ----
    supabase: {
      url: 'https://YOUR_PROJECT_ID.supabase.co',
      anonKey: 'YOUR_SUPABASE_ANON_KEY',
      bucketName: 'audio-recordings',
    },
  },

  // ==========================================
  // 二、实验参数
  // ==========================================
  experiment: {
    name: '语言交互行为实验',
    version: '2.0.0',
    
    // 录音均为手动启停模式（被试自主控制开始/结束）
    // 以下为安全上限（秒）
    micTestMaxDuration: 30,
    voiceAnswerMaxDuration: 120,
    
    // 音频格式
    audioMimeType: 'audio/webm;codecs=opus',
    
    // 是否显示影院跳过按钮（调试用，正式实验应设为 false）
    showSkipButton: true,
    
    // ★★★ 调试模式 ★★★
    // true  = 跳过伦理声明、麦克风测试、被试编号，直接进入全屏视频
    // false = 完整实验流程（正式实验用）
    debugMode: true,
    
    // 是否在本地存储备份数据
    localStorageBackup: true,
  },

  // ==========================================
  // 三、情景配置 ★★★ 自定义你的实验内容 ★★★
  // ==========================================
  scenario: {
    // ---- 视频库 ----
    // 命名规则: scenario1.mp4(开场) → scenario2.mp4(Q1→Q2过渡) → scenario3.mp4(Q2→Q3过渡) → ... → scenarioN.mp4(最终)
    // 系统会根据题目数量自动生成序列，只需按规则将视频放入 assets/video/ 目录
    videos: {
      // 以下为示例，实际播放时会自动补全未定义的键
      scenario1: 'assets/video/Scenario1.mp4',
      scenario2: 'assets/video/Scenario2.mp4',
      
      // ★★★ 预留：分支视频 ★★★
      branch_a: 'assets/video/branch_a.mp4',
      branch_b: 'assets/video/branch_b.mp4',
    },
    
    // 选择题 — 9道共情水平测试，1水平→A，2水平→B，3水平→C
    questions: [
      {
        id: 'q1',
        stem: '看到小宇站在台阶边、脸红、一直不下水，你觉得他现在的心情是什么？',
        options: [
          { value: 'A', label: '他可能就是想再等一等，看看水温再下去。', video: 'assets/video/1_A.mp4' },
          { value: 'B', label: '他可能是怕水，所以一直不敢下水。', video: 'assets/video/1_B.mp4' },
          { value: 'C', label: '他既怕水又怕被人看出来，所以更不敢下了。', video: 'assets/video/1_c.mp4' },
        ],
      },
      {
        id: 'q2',
        stem: '小宇说"没有啊"，却迟迟不动，假装在调整泳镜。你觉得他为什么这样？',
        options: [
          { value: 'A', label: '可能他真的不怕，只是泳镜不合适，要调一下。', video: 'assets/video/2_A.mp4' },
          { value: 'B', label: '他单纯不想理小杰。', video: 'assets/video/2_B.mp4' },
          { value: 'C', label: '他想在大家面前掩饰自己怕水。', video: 'assets/video/2_C.mp4' },
        ],
      },
      {
        id: 'q3',
        stem: '小宇鼓起勇气把这句话告诉了你。听完之后，你心里怎么想？',
        options: [
          { value: 'A', label: '呛水很常见，没什么大不了的。', video: 'assets/video/3_A.mp4' },
          { value: 'B', label: '他愿意说出来不容易，怕呛水这种感觉我也能理解。', video: 'assets/video/3_B.mp4' },
          { value: 'C', label: '他说出这句话需要勇气，怕呛水又怕被笑话，很难受。', video: 'assets/video/3_C.mp4' },
        ],
      },
      {
        id: 'q4',
        stem: '听到小杰说"这有什么好怕的"，你心里有什么感觉？',
        options: [
          { value: 'A', label: '小杰说得也没错，就是头埋下去再抬起来，试一次就行了。', video: 'assets/video/4_A.mp4' },
          { value: 'B', label: '小杰这样说小宇肯定不高兴了。', video: 'assets/video/4_B.mp4' },
          { value: 'C', label: '小宇听到这种话肯定更紧张，更不敢下水了。', video: 'assets/video/4_C.mp4' },
        ],
      },
      {
        id: 'q5',
        stem: '你会对小宇说什么？',
        options: [
          { value: 'A', label: '好了，我们别浪费时间了，赶紧下水吧。', video: 'assets/video/5_A.mp4' },
          { value: 'B', label: '你别理他，他平常跟别人说话也这样。', video: 'assets/video/5_B.mp4' },
          { value: 'C', label: '我一开始学也怕呛水，特别能懂你的感受。', video: 'assets/video/5_C.mp4' },
        ],
      },
      {
        id: 'q6',
        stem: '你这时候会怎么做？',
        options: [
          { value: 'A', label: '他已经下水练换气了，应该没什么问题了。', video: 'assets/video/6_A.mp4' },
          { value: 'B', label: '我游过去问他："你是不是也想跟大家一起去？"', video: 'assets/video/6_B.mp4' },
          { value: 'C', label: '我游过去说："你自己一个人会不会无聊啊，要不要咱俩一起练练换气？"', video: 'assets/video/6_C.mp4' },
        ],
      },
      {
        id: 'q7',
        stem: '你会怎么说？',
        options: [
          { value: 'A', label: '"没事儿吧，你怎么呛水了？"', video: 'assets/video/7_A.mp4' },
          { value: 'B', label: '"呛水肯定很难受吧，先缓一缓。"', video: 'assets/video/7_B.mp4' },
          { value: 'C', label: '"没事的。你今天能下来，已经很勇敢了。"', video: 'assets/video/7_C.mp4' },
        ],
      },
      {
        id: 'q8',
        stem: '你会怎么回应他？',
        options: [
          { value: 'A', label: '"那好吧，你自己练吧，我先去那边了。"', video: 'assets/video/8_A.mp4' },
          { value: 'B', label: '"我在这儿挺好的呀，再试试换气呗。"', video: 'assets/video/8_B.mp4' },
          { value: 'C', label: '"没事儿你不用不好意思，是我自己想陪你练气。"', video: 'assets/video/8_C.mp4' },
        ],
      },
      {
        id: 'q9',
        stem: '小宇说："他们都在那边玩，就我一直学不会，老师和同学肯定在偷偷笑我。"',
        options: [
          { value: 'A', label: '你别那么敏感吧，别想那么多嘛。', video: 'assets/video/9_A.mp4' },
          { value: 'B', label: '不用在意别人的看法，他们怎么想是他们的事。', video: 'assets/video/9_B.mp4' },
          { value: 'C', label: '你已经进步得很快了，我们一起再练练肯定就更好了。', video: 'assets/video/9_C.mp4' },
        ],
      },
    ],

    // ★★★ Galgame 选项音频映射 ★★★
    // 格式: {questionId}_{optionValue} → 音频文件路径
    // 例如: 'q1_A' → 'assets/audio/1_1.wav' 表示第1题选项A的音频
    optionAudio: {
      'q1_A': 'assets/audio/1_1.wav',
      'q1_B': 'assets/audio/1_2.wav',
      'q1_C': 'assets/audio/1_3.wav',
      'q2_A': 'assets/audio/2_1.wav',
      'q2_B': 'assets/audio/2_2.wav',
      'q2_C': 'assets/audio/2_3.wav',
      'q3_A': 'assets/audio/3_1.wav',
      'q3_B': 'assets/audio/3_2.wav',
      'q3_C': 'assets/audio/3_3.wav',
      'q4_A': 'assets/audio/4_1.wav',
      'q4_B': 'assets/audio/4_2.wav',
      'q4_C': 'assets/audio/4_3.wav',
      'q5_A': 'assets/audio/5_1.wav',
      'q5_B': 'assets/audio/5_2.wav',
      'q5_C': 'assets/audio/5_3.wav',
      'q6_A': 'assets/audio/6_1.wav',
      'q6_B': 'assets/audio/6_2.wav',
      'q6_C': 'assets/audio/6_3.wav',
      'q7_A': 'assets/audio/7_1.wav',
      'q7_B': 'assets/audio/7_2.wav',
      'q7_C': 'assets/audio/7_3.wav',
      'q8_A': 'assets/audio/8_1.wav',
      'q8_B': 'assets/audio/8_2.wav',
      'q8_C': 'assets/audio/8_3.wav',
      'q9_A': 'assets/audio/9_1.wav',
      'q9_B': 'assets/audio/9_2.wav',
      'q9_C': 'assets/audio/9_3.wav',
    },

    // Galgame 角色设定
    characters: {
      // 左侧角色（叙述者/主角视角）
      left: {
        name: '我',
        placeholder: false,
        image: 'assets/images/man.png',
      },
      // 右侧角色（提问者）
      right: {
        name: '提问者',
        placeholder: false,
        image: 'assets/images/teacher.png',
      },
    },

    // 语音问题
    voiceQuestion: '请用语音回答：在刚才的情景中，您做出选择的主要原因是什么？',

    // 分支逻辑（预留）
    branching: {},
    
    totalVideoNodes: 2,
  },

  // ==========================================
  // 四、UI 文本（可定制）
  // ==========================================
  ui: {
    consentTitle: '🎓 语言交互行为实验',
    micTestTitle: '🎤 麦克风测试',
    subjectTitle: '📋 被试信息',
    cinemaTitle: '🎬 互动视频',
    completeTitle: '✅ 实验完成',
  },
};

// 导出（如果使用模块化加载）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXPERIMENT_CONFIG;
}
