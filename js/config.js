/**
 * ============================================================
 * 实验配置 v3.0 — 多故事支持
 * ============================================================
 * 使用前请根据您的实际部署修改以下配置。
 * ============================================================
 */

const EXPERIMENT_CONFIG = {
  // ==========================================
  // 一、后端存储配置
  // ==========================================
  backend: {
    type: 'feishu',

    // 飞书多维表格后端
    feishu: {
      apiEndpoint: 'http://localhost:3456/api/submit',
      // 如果部署到云端，改为实际 HTTPS 地址:
      // apiEndpoint: 'https://your-server.com/api/submit',
    },

    aliyun: {
      apiEndpoint: 'https://YOUR_API_GATEWAY_ID.apigateway.aliyuncs.com/prod/experiment/upload',
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      oss: {
        region: 'oss-cn-hangzhou',
        bucket: 'your-experiment-bucket',
        endpoint: 'https://your-experiment-bucket.oss-cn-hangzhou.aliyuncs.com',
        accessKeyId: 'YOUR_OSS_ACCESS_KEY_ID',
        accessKeySecret: 'YOUR_OSS_ACCESS_KEY_SECRET',
      },
    },

    leancloud: {
      appId: 'YOUR_LEANCLOUD_APP_ID',
      appKey: 'YOUR_LEANCLOUD_APP_KEY',
      serverURL: 'https://YOUR_APP_ID.api.lncldglobal.com',
    },

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
    version: '3.0.0',

    micTestMaxDuration: 30,
    voiceAnswerMaxDuration: 120,
    audioMimeType: 'audio/webm;codecs=opus',
    showSkipButton: true,
    debugMode: true,
    localStorageBackup: true,
  },

  // ==========================================
  // 三、故事配置 ★★★
  // ==========================================
  // enabled: true 的故事会在选择器中显示
  // 命名规则：
  //   视频: assets/video/{id}/Scenario1.mp4 ~ Scenario10.mp4
  //   问题语音: assets/audio/{id}/q1.mp3 ~ q6.mp3 (仅前6题)
  //   选项语音: assets/audio/{id}/{题号}-{选项编号}.mp3
  //             e.g. 1-1.mp3(第1题A), 3-2.mp3(第3题B), 9-3.mp3(第9题C)
  // audioExt:    音频文件扩展名 ('mp3' 或 'wav')
  // questionAudioCount: 前 N 题播放问题语音，之后直接出选项
  // ==========================================
  stories: [
    // ---- 故事1：游泳课 ----
    {
      id: 'swim',
      name: '游泳课',
      enabled: true,
      audioExt: 'wav',              // 已有文件是 wav 格式
      videoFolder: 'assets/video/swim',
      audioFolder: 'assets/audio/swim',
      questionAudioCount: 6,
      transitionText: '课间，同学们换好泳衣来到游泳池边。你注意到小宇站在台阶边，脸红红的，一直不下水...',
      voiceQuestion: '请用语音回答：在刚才的情景中，您做出选择的主要原因是什么？',
      questions: [
        {
          id: 'q1',
          stem: '看到小宇站在台阶边、脸红、一直不下水，你觉得他现在的心情是什么？',
          options: [
            { value: 'A', label: '他可能就是想再等一等，看看水温再下去。' },
            { value: 'B', label: '他可能是怕水，所以一直不敢下水。' },
            { value: 'C', label: '他既怕水又怕被人看出来，所以更不敢下了。' },
          ],
        },
        {
          id: 'q2',
          stem: '小宇说"没有啊"，却迟迟不动，假装在调整泳镜。你觉得他为什么这样？',
          options: [
            { value: 'A', label: '可能他真的不怕，只是泳镜不合适，要调一下。' },
            { value: 'B', label: '他单纯不想理小杰。' },
            { value: 'C', label: '他想在大家面前掩饰自己怕水。' },
          ],
        },
        {
          id: 'q3',
          stem: '小宇鼓起勇气把这句话告诉了你。听完之后，你心里怎么想？',
          options: [
            { value: 'A', label: '呛水很常见，没什么大不了的。' },
            { value: 'B', label: '他愿意说出来不容易，怕呛水这种感觉我也能理解。' },
            { value: 'C', label: '他说出这句话需要勇气，怕呛水又怕被笑话，很难受。' },
          ],
        },
        {
          id: 'q4',
          stem: '听到小杰说"这有什么好怕的"，你心里有什么感觉？',
          options: [
            { value: 'A', label: '小杰说得也没错，就是头埋下去再抬起来，试一次就行了。' },
            { value: 'B', label: '小杰这样说小宇肯定不高兴了。' },
            { value: 'C', label: '小宇听到这种话肯定更紧张，更不敢下水了。' },
          ],
        },
        {
          id: 'q5',
          stem: '你会对小宇说什么？',
          options: [
            { value: 'A', label: '好了，我们别浪费时间了，赶紧下水吧。' },
            { value: 'B', label: '你别理他，他平常跟别人说话也这样。' },
            { value: 'C', label: '我一开始学也怕呛水，特别能懂你的感受。' },
          ],
        },
        {
          id: 'q6',
          stem: '你这时候会怎么做？',
          options: [
            { value: 'A', label: '他已经下水练换气了，应该没什么问题了。' },
            { value: 'B', label: '我游过去问他："你是不是也想跟大家一起去？"' },
            { value: 'C', label: '我游过去说："你自己一个人会不会无聊啊，要不要咱俩一起练练换气？"' },
          ],
        },
        {
          id: 'q7',
          stem: '你会怎么说？',
          options: [
            { value: 'A', label: '"没事儿吧，你怎么呛水了？"' },
            { value: 'B', label: '"呛水肯定很难受吧，先缓一缓。"' },
            { value: 'C', label: '"没事的。你今天能下来，已经很勇敢了。"' },
          ],
        },
        {
          id: 'q8',
          stem: '你会怎么回应他？',
          options: [
            { value: 'A', label: '"那好吧，你自己练吧，我先去那边了。"' },
            { value: 'B', label: '"我在这儿挺好的呀，再试试换气呗。"' },
            { value: 'C', label: '"没事儿你不用不好意思，是我自己想陪你练气。"' },
          ],
        },
        {
          id: 'q9',
          stem: '小宇说："他们都在那边玩，就我一直学不会，老师和同学肯定在偷偷笑我。"',
          options: [
            { value: 'A', label: '你别那么敏感吧，别想那么多嘛。' },
            { value: 'B', label: '不用在意别人的看法，他们怎么想是他们的事。' },
            { value: 'C', label: '你已经进步得很快了，我们一起再练练肯定就更好了。' },
          ],
        },
      ],
    },

    // ---- 故事2：午餐 ----
    {
      id: 'diningHall',
      name: '午餐',
      enabled: true,
      audioExt: 'mp3',
      videoFolder: 'assets/video/diningHall',
      audioFolder: 'assets/audio/diningHall',
      questionAudioCount: 6,
      transitionText: '午休时间，全班来到食堂吃午餐。小哲站在队伍末尾，磨磨蹭蹭不肯上前，一脸提不起精神...',
      voiceQuestion: '请用语音回答：在刚才的情景中，您做出选择的主要原因是什么？',
      questions: [
        {
          id: 'q1',
          stem: '排队取餐时，小哲一直无精打采、磨磨蹭蹭不肯上前，你觉得他当下是什么心情？',
          options: [
            { value: 'A', label: '他就是故意偷懒，不想乖乖排队吃饭。' },
            { value: 'B', label: '他不想吃饭，单纯想早点出去玩。' },
            { value: 'C', label: '他因为吃不到想吃的饭菜，心里失落提不起劲。' },
          ],
        },
        {
          id: 'q2',
          stem: '小哲端着餐盘站在原地没有立刻开心起来，你觉得他在想什么？',
          options: [
            { value: 'A', label: '他想霸占这份不属于自己的餐食。' },
            { value: 'B', label: '他在犹豫要不要告诉小华拿错了餐。' },
            { value: 'C', label: '这是小华的餐食，他担心小华吃到不喜欢的饭。' },
          ],
        },
        {
          id: 'q3',
          stem: '小哲主动提出和小华换回餐食，你怎么看待？',
          options: [
            { value: 'A', label: '一顿饭而已，没必要纠结，他想得太多了。' },
            { value: 'B', label: '他怕小华怪自己拿错了餐却不告诉他。' },
            { value: 'C', label: '他怕小华不开心。' },
          ],
        },
        {
          id: 'q4',
          stem: '小华表示不用换餐，小哲终于放下心事，开心地分享食物，你内心是什么感受？',
          options: [
            { value: 'A', label: '折腾了半天，他两终于都能好好吃饭了。' },
            { value: 'B', label: '一份饭菜而已，没必要这么兴奋吧。' },
            { value: 'C', label: '如愿吃到爱吃的饭肯定是很开心的。' },
          ],
        },
        {
          id: 'q5',
          stem: '小哲说起家长给自己登记错了饭菜的乌龙，这时你会如何和他交流？',
          options: [
            { value: 'A', label: '别一直聊天了，抓紧时间把自己的午饭吃完。' },
            { value: 'B', label: '食堂的糖醋里脊，味道确实很不错。' },
            { value: 'C', label: '我之前吃到喜欢的红烧鸡腿也开心了好久。' },
          ],
        },
        {
          id: 'q6',
          stem: '小哲放错餐盘被老师提醒，还引来其他同学注视，整个人局促不安，你会怎么做？',
          options: [
            { value: 'A', label: '在一旁看看情况，感觉跟他一起有点尴尬' },
            { value: 'B', label: '提醒他，"餐盘位置在这儿呢"，之后把自己的餐盘放到正确的位置。' },
            { value: 'C', label: '主动走到他身边陪着他，轻声安抚他："没事，你也不是故意的。"' },
          ],
        },
        {
          id: 'q7',
          stem: '小哲委屈地解释："我只是太着急了才看错地方。" 你会怎么安慰他？',
          options: [
            { value: 'A', label: '错了就错了呗，没必要找理由辩解' },
            { value: 'B', label: '没事啊，下次细心一点就行。' },
            { value: 'C', label: '我知道你不是故意的，老师也只是提醒一下你，不是批评你。' },
          ],
        },
        {
          id: 'q8',
          stem: '同班同学小明路过说食堂阿姨收拾更麻烦了，小哲说"我最近老给别人添麻烦"，你会如何回应？',
          options: [
            { value: 'A', label: '你想太多了，多大点事啊。' },
            { value: 'B', label: '别太在意，大家都有犯错的时候。' },
            { value: 'C', label: '别难为情啦，下回我们互相提醒就好了。' },
          ],
        },
        {
          id: 'q9',
          stem: '小哲手忙脚乱摆放餐具还碰倒了其他餐盘，你会怎么做？',
          options: [
            { value: 'A', label: '看了一眼散落的餐盘，决定自己先回教室。' },
            { value: 'B', label: '走到他旁边："你别急啊，你看越急越乱。"' },
            { value: 'C', label: '走过去帮他把碰倒的餐具扶起来："我帮你一起收拾。"' },
          ],
        },
      ],
    },

    // ---- 故事3：校运会失利 ----
    {
      id: 'playground',
      name: '校运会失利',
      enabled: true,
      audioExt: 'mp3',
      videoFolder: 'assets/video/playground',
      audioFolder: 'assets/audio/playground',
      questionAudioCount: 6,
      transitionText: '班会课上，老师说要推选参加校运会接力赛的选手。大家你一言我一语，好几个人都喊出了小星的名字...',
      voiceQuestion: '请用语音回答：在刚才的情景中，您做出选择的主要原因是什么？',
      questions: [
        {
          id: 'q1',
          stem: '被提名接力赛选手时，小星的表情有点僵，头慢慢低了下去。你心里怎么想？',
          options: [
            { value: 'A', label: '被选上多光荣啊，干嘛低着头？' },
            { value: 'B', label: '他好像不太愿意被选上。' },
            { value: 'C', label: '他可能怕跑不好丢脸，但又不好意思拒绝大家。' },
          ],
        },
        {
          id: 'q2',
          stem: '下课后小星一个人趴在桌上，把脸埋在胳膊里。你会怎么做？',
          options: [
            { value: 'A', label: '走到他旁边，有点犹豫要不要跟他搭话。' },
            { value: 'B', label: '走过去拍拍他："你被选上啦，多好的事啊！"' },
            { value: 'C', label: '有点担心他，坐到他旁边问："你是不是不太想去？"' },
          ],
        },
        {
          id: 'q3',
          stem: '小星低声说："我怕自己做不好……可大家都选我……。"你怎么说？',
          options: [
            { value: 'A', label: '"代表班级比赛是很光荣的事情啊。"' },
            { value: 'B', label: '"换我我也会纠结，答应了怕跑不好，又不好意思拒绝。"' },
            { value: 'C', label: '"去比赛的都会紧张，别想太多，跑就完了。"' },
          ],
        },
        {
          id: 'q4',
          stem: '小星问："万一跑不好，大家会怎么想？"',
          options: [
            { value: 'A', label: '"大家不会怪你的，别担心。"' },
            { value: 'B', label: '"跑都还没跑呢，想这些干嘛。"' },
            { value: 'C', label: '"你是怕让大家失望吧？别紧张，尽力去跑就好了。"' },
          ],
        },
        {
          id: 'q5',
          stem: '接力赛掉棒后，小星一个人坐在操场角落，低着头不说话。你心里怎么想？',
          options: [
            { value: 'A', label: '他担心的事还是发生了，肯定又自责又难过。' },
            { value: 'B', label: '他是不是还在想比赛的事？' },
            { value: 'C', label: '他应该是因为刚刚掉棒了有点难受。' },
          ],
        },
        {
          id: 'q6',
          stem: '小星红着眼眶说："大家都那么信任我，我却掉棒了……我觉得自己好没用。"',
          options: [
            { value: 'A', label: '"别再怪自己了，谁还没有失误的时候。"' },
            { value: 'B', label: '"我懂你的心情，我跳绳比赛总绊住也觉得特别自责。"' },
            { value: 'C', label: '"掉棒是个意外，大家都没想到。"' },
          ],
        },
        {
          id: 'q7',
          stem: '小星低着头："同学们肯定都在怪我……"',
          options: [
            { value: 'A', label: '你摊开手，"随便他们怎么说，你别理就行。"' },
            { value: 'B', label: '你拍拍他的肩膀，"怎么会怪你呢？大家都知道你练了很久。"' },
            { value: 'C', label: '"别想太多，一次失误不代表什么。"' },
          ],
        },
        {
          id: 'q8',
          stem: '小星抱着膝盖说："我再也不想跑接力了……以后这种比赛别叫我了。"',
          options: [
            { value: 'A', label: '"你要是实在压力太大，不想去就别去了。"' },
            { value: 'B', label: '"别啊，你要是不参加了，我们班接力赛更没戏了。"' },
            { value: 'C', label: '"大家推选你是认可你，不要着急否定自己。"' },
          ],
        },
        {
          id: 'q9',
          stem: '小星声音闷闷的："我也不是不想跑，可就是怕……怕下次一上场，手又抖，棒又掉了……"',
          options: [
            { value: 'A', label: '"别太担心，你再多练练肯定能行。"' },
            { value: 'B', label: '"下次自己小心一点就行了，注意点就不会掉棒了。"' },
            { value: 'C', label: '"我们来复盘一下失误的原因，之后我陪你加练怎么样？"' },
          ],
        },
      ],
    },

    // ---- 故事4：摔伤腿休养后重返校园 ----
    {
      id: 'brokeleg',
      name: '摔伤腿休养后重返校园',
      enabled: true,
      audioExt: 'mp3',
      videoFolder: 'assets/video/brokeleg',
      audioFolder: 'assets/audio/brokeleg',
      questionAudioCount: 6,
      transitionText: '班里同学小航前段时间摔伤了腿，在家休养了一段时间。老师在课间宣布小航马上就要重新回到班级上课了...',
      voiceQuestion: '请用语音回答：在刚才的情景中，您做出选择的主要原因是什么？',
      questions: [
        {
          id: 'q1',
          stem: '想到小航下周要返校，你心里的想法是？',
          options: [
            { value: 'A', label: '他腿受伤了，一回来我们估计都得让着他。' },
            { value: 'B', label: '小航终于要回来了，又多一个人可以一起打闹了。' },
            { value: 'C', label: '小航好久没来学校，肯定也想我们了吧，我会好好照顾他的。' },
          ],
        },
        {
          id: 'q2',
          stem: '从小航冷淡简短的消息、频繁叹气的语音里，你觉得他当下是什么心情？',
          options: [
            { value: 'A', label: '他只是在家养病太无聊，单纯没事干才叹气。' },
            { value: 'B', label: '他腿还疼，行动不方便，所以心情不好。' },
            { value: 'C', label: '他的腿还没好，而且好久没见同学，感觉有点孤单。' },
          ],
        },
        {
          id: 'q3',
          stem: '你会说什么？',
          options: [
            { value: 'A', label: '你在家休息这么久，是不是都不想来上学了？' },
            { value: 'B', label: '你终于要回学校了，我们等你好久了。' },
            { value: 'C', label: '我们都很想你，周一需不需要我们去校门口接你？' },
          ],
        },
        {
          id: 'q4',
          stem: '小航说担心落下功课、走路慢吞吞给大家添麻烦，你如何回应？',
          options: [
            { value: 'A', label: '你就是想太多了，啥时候变得婆婆妈妈的。' },
            { value: 'B', label: '没什么好担心的，回来了就好。' },
            { value: 'C', label: '没关系，你也不用太担心，老师和同学们都会帮你的。' },
          ],
        },
        {
          id: 'q5',
          stem: '体育课自由活动，小航一个人坐在台阶上看着大家打球跑步。你心里怎么想？',
          options: [
            { value: 'A', label: '他怎么一个人坐在那儿？' },
            { value: 'B', label: '他腿还没好利索，没法跟大家一起玩。' },
            { value: 'C', label: '他只能一个人坐在旁边看，肯定又无聊又失落。' },
          ],
        },
        {
          id: 'q6',
          stem: '小航说"腿还没好透，跑也跑不了，只能在这儿坐着看。"你怎么说？',
          options: [
            { value: 'A', label: '"那你就好好坐着休息呗，正好这里晒不到太阳很凉快。"' },
            { value: 'B', label: '"别着急，等腿好了就能和我们一起玩了。"' },
            { value: 'C', label: '"一个人坐着有点无聊吧，我陪你聊聊天，正好我也跑累了。"' },
          ],
        },
        {
          id: 'q7',
          stem: '小航低着头说："这么久没回来，感觉跟大家都没话聊了。"你怎么说？',
          options: [
            { value: 'A', label: '"不至于吧，多聊几句不就好了。"' },
            { value: 'B', label: '"你太久没来学校了，刚开始没话题很正常。"' },
            { value: 'C', label: '"我之前请假回来也是，聊天没接住梗，挺尴尬的。"' },
          ],
        },
        {
          id: 'q8',
          stem: '小航说："以前我跟小杰他们什么都说，现在感觉自己像个外人。"你怎么说？',
          options: [
            { value: 'A', label: '"你太敏感了，他们没那个意思。"' },
            { value: 'B', label: '"总有个过渡期，给大家一点时间。"' },
            { value: 'C', label: '"感觉跟好朋友生疏了，有点失落很正常。"' },
          ],
        },
        {
          id: 'q9',
          stem: '下课后小杰他们说说笑笑走过，没注意到小航。你怎么做？',
          options: [
            { value: 'A', label: '大喊："嘿小杰！小航说你们跟他都没话聊。"' },
            { value: 'B', label: '"他们在那呢，你去跟他们聊聊呗？"' },
            { value: 'C', label: '"走，我跟你一起过去，咱们先聊聊以前你们一起打篮球的事。"' },
          ],
        },
      ],
    },

    // ---- 故事5：预留 ----
    {
      id: 'failed',
      name: '待定',
      enabled: false,
      audioExt: 'mp3',
      videoFolder: 'assets/video/failed',
      audioFolder: 'assets/audio/failed',
      questionAudioCount: 6,
      transitionText: '',
      voiceQuestion: '请用语音回答：在刚才的情景中，您做出选择的主要原因是什么？',
      questions: [],
    },
  ],

  // ==========================================
  // 四、UI 文本
  // ==========================================
  ui: {
    consentTitle: '🎓 语言交互行为实验',
    micTestTitle: '🎤 麦克风测试',
    subjectTitle: '📋 被试信息',
    cinemaTitle: '🎬 互动视频',
    completeTitle: '✅ 实验完成',
  },
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXPERIMENT_CONFIG;
}
