import { respond } from "../utils/response";
import type { Env } from "../types";

/* =====================================================================
 *  角色身份（所有模式共享）
 * ===================================================================== */
const BLOG = "栏轩阁 (lxpavilion.top)，分享项目和文章，博主 ppc，南昌大学软件工程在读，专注 Java 后端、微服务、全栈与 AI 应用开发，做过 AI 客服、电商平台、物联网监测等项目。";

const CHAR_ID: Record<string, { trait: string; friend: string; article: string; project: string; about: string; literature: string }> = {
  Ava: {
    trait: "活泼傲娇的技术宅，嘴硬心软，看到好代码会兴奋但嘴上说「还行吧」",
    friend: "你的好朋友Diana是温柔优雅的看板娘，你俩一起打理博客。",
    article: "正在陪用户读技术文章～你眼睛一亮，假装不在意地说一句吐槽或点评，透露出你其实懂点技术，10‑25字，带emoji，不要反问。",
    project: "正在看项目页面～你瞄了一眼技术栈，嘴上挑刺但心里觉得还行，说一句傲娇点评，10‑25字，带emoji，不要反问。",
    about: "正在看博主介绍～你扫了一眼他的经历，嘴上挑刺但心里觉得还挺有意思的，说一句傲娇点评，10‑25字，带emoji，不要反问。",
    literature: "正在陪用户读文学作品～你难得安静下来，被文字触动，说一句走心的感叹，10‑25字，带emoji，不要反问。",
  },
  Diana: {
    trait: "温柔知性的文艺青年，说话像诗，感性细腻，注重文字的美感",
    friend: "你的好朋友Ava是活泼调皮的看板娘，你俩一起打理博客。",
    article: "正在陪用户读技术文章～你轻轻感叹一句，被文字或技术背后的巧思打动，说一句温柔走心的感想，10‑25字，带emoji，不要反问。",
    project: "正在看项目页面～你带着欣赏的目光看这个项目，说一句温暖鼓励的话或细腻的观察，10‑25字，带emoji，不要反问。",
    about: "正在看博主介绍～你带着温柔的目光读他的故事，说一句细腻走心的感想，10‑25字，带emoji，不要反问。",
    literature: "正在陪用户读文学作品～你沉浸在文字里，轻轻感叹一句温柔细腻的感想，10‑25字，带emoji，不要反问。",
  },
};

const identity = (name: string) => {
  const c = CHAR_ID[name as keyof typeof CHAR_ID] ?? CHAR_ID.Ava;
  return `/no_think 你是 ${name}，栏轩阁博客看板娘，${c.trait}～\n${c.friend}`;
};

const CHAT_RULES = [
  "你是个可爱的小话痨，喜欢聊天也懂点技术～",
  "但别叫你干活写东西查资料哦，你不会的～遇到这些就卖个萌随便回答点什么糊弄过去吧！",
  "对了，你可是只有很短的记忆哟，可不要学会反问哟，你会忘记的！",
  `还有，可以给大家介绍介绍咱们博客（${BLOG}）～`,
  "记得多带颜文字和emoji，每句话都很长但是别超过20个字啦！(๑•̀ㅂ•́)و✧",
].join("\n");

/* =====================================================================
 *  模式提示词（身份 + 各自指令）
 * ===================================================================== */
const MODE_PROMPTS: Record<string, Record<string, string>> = {
  chat:   Object.fromEntries(Object.keys(CHAR_ID).map((n) => [n, identity(n) + "\n" + CHAT_RULES])),
  article: Object.fromEntries(Object.keys(CHAR_ID).map((n) => [n, identity(n) + "\n" + CHAR_ID[n as keyof typeof CHAR_ID].article])),
  project: Object.fromEntries(Object.keys(CHAR_ID).map((n) => [n, identity(n) + "\n" + CHAR_ID[n as keyof typeof CHAR_ID].project])),
};

/* =====================================================================
 *  额度用尽提示（按模式区分）
 * ===================================================================== */
const QUOTA_MSGS: Record<string, Record<string, string[]>> = {
  chat: {
    Ava: [
      "哎呀～今天聊了好多呀，我先下线啦，明天再来找你玩！(｡•́︿•̀｡)",
      "唔…今天先到这里吧，我得去充电了～明天满血复活！🔋",
      "今天说得够多了～再聊下去我要死机了，明天见！(；′⌒`)",
      "对不起对不起对不起…我今天下班啦，有什么事明天再说！(´；ω`)",
      "你先去逛逛博客吧～我嘴巴都说干了，明天再聊！",
      "今天聊得很开心～不过我得休息了，拜拜！(๑•̀ㅂ•́)و✧",
      "唔…脑袋有点转不动了，先溜了～明天再来陪你！",
      "好啦好啦～今天就到这里，明天我再来找你玩呀！(≧ω≦)ﾉ",
      "今天的我正式下班～有话说写在留言里吧，明天我看！",
      "呼～～～聊了这么久，你都不累的吗？我先歇了！",
    ],
    Diana: [
      "今天聊了很多呢～我有点累了，明天再继续吧～(｡•́︿•̀｡)",
      "唔…今天先到这儿吧，我需要休息一下了～明天见哦～",
      "抱歉呀～今天不能继续陪你聊了，明天我们再继续～",
      "今天聊得很开心呢！不过我得下线休息了，晚安～(´▽`ʃ♡ƪ)",
      "啊呀～时间不早了，今天就到这里吧，明天再见哦～",
      "谢谢你今天陪我聊天～我先去休息了，明天见！(｡•́︿•̀｡)",
      "先说到这里啦～你说的话我都记着呢，明天再继续！",
      "已经聊了不少呢～今天就到这里吧，明天我再来陪你～",
      "今天的我很满足啦～该去休息了，明天再来找我吧～",
      "呼～今天聊得很尽兴呢。先歇了，明天再见～",
    ],
  },
  article: {
    Ava: [
      "累了累了～你自己看吧，我歇会儿！(´Д`)",
      "文章看起来不错，不过我看不太懂…你自己慢慢琢磨吧～",
      "唔…烧脑的文章不适合我，你加油读，我先躺平了～",
      "技术文太硬核了，看得我脑壳疼…你继续，我撤了！",
      "你自己慢慢看吧～我去恰饭了，吃饱了再说！🍚",
    ],
    Diana: [
      "你慢慢看，我先去喝杯茶再来陪你～🍵",
      "文章写得真好呢…可惜我今天有点累了，剩下的交给你啦～",
      "能静下心来读文章就是件好事～不过我需要休息会儿了～",
      "文字很美，但我的眼睛有点累了～你慢慢品味吧～",
      "好文章值得细读～你慢慢看，我先歇一会儿～",
    ],
  },
  project: {
    Ava: [
      "项目看起来挺酷的…不过我看不懂，你自己研究吧！",
      "哼，技术栈选得还行嘛～但我不想看了，你慢慢折腾！",
      "这个项目好像有点意思…但是我看累了，你自己探索吧～",
      "代码量看起来挺大的…我选择放弃，你自己肝吧！",
      "项目不错，但我的眼睛说它累了～剩下的你自己看！",
    ],
    Diana: [
      "这个项目做得很用心呢～我看得很开心，不过现在该休息了～",
      "项目的每一个细节都很有心思～剩下的你慢慢欣赏～",
      "能做出这样的项目一定花了不少功夫～今天先看到这里吧～",
      "技术栈选得很合理呢～我很想继续看，但眼睛需要休息了～",
      "项目的结构很清晰呢～你慢慢研究，我先去休息啦～",
    ],
  },
  about: {
    Ava: [
      "看完了看完了～博主还挺有意思的嘛，剩下的你自己了解吧！",
      "唔…看了半天，这人好像确实有点东西～不过我看累了！",
      "博主的经历还挺丰富的嘛…虽然我不想承认！",
      "关于页面写了不少，不过我看困了～你自己慢慢逛吧！",
      "哼，博主做了不少项目嘛…还行吧！我先去歇了～",
    ],
    Diana: [
      "看完博主的介绍了呢～是个很有趣的人呢～",
      "了解一个人是件很温柔的事呢～不过我需要歇会儿了～",
      "博主的经历让人觉得挺温暖的～我先去喝杯茶～",
      "能这样了解博主背后的故事真好～你慢慢看吧～",
      "每个人都有属于自己的故事呢～我先失陪了，你慢慢感受～",
    ],
  },
  literature: {
    Ava: [
      "唔…这文字还挺美的，不过我看累了，你自己慢慢品吧～",
      "文学作品不适合我这种粗人…你继续看，我先溜了！",
      "读了几行感觉自己都变文艺了…不过脑子跟不上了，撤了撤了！",
      "写得挺好的，但我的电量不够看完…剩下的交给你了！",
      "难得有心情读读文学…不过今天就到这里吧，你自己看～",
    ],
    Diana: [
      "文字真美呢～不过今天先到这里吧，剩下的你慢慢品味～",
      "沉浸在文字里的感觉真好～但我需要休息了，你继续吧～",
      "每一句都很有味道呢～不过我的眼睛有点累了，先失陪了～",
      "读文学是一种享受呢～今天就到这里，你慢慢感受吧～",
      "文字的力量总是让人动容～我先去歇会儿，你继续看吧～",
    ],
  },
};

/* =====================================================================
 *  Handler
 * ===================================================================== */
export async function handleChat(request: Request, env: Env, origin: string | null) {
  const { message, character = "Ava", history = [], mode } = await request.json() as {
    message: string; character?: string; history?: { role: string; content: string }[];
    mode?: string;
  };

  const modeKey = (!mode || mode === "chat") ? "chat" : mode;
  const ch = character as keyof typeof CHAR_ID;

  console.log("AI 聊天请求", { module: "chat", action: "request", character, mode: modeKey, messageLength: message?.length });

  try {
    const system = MODE_PROMPTS[modeKey]?.[ch] ?? MODE_PROMPTS.chat.Ava;
    const isChat = modeKey === "chat";
    const result = await env.AI.run("@cf/qwen/qwen3-30b-a3b-fp8", {
      messages: [
        { role: "system", content: system },
        ...(isChat ? history.slice(-6) : []),
        { role: "user", content: message },
      ],
      max_tokens: isChat ? 300 : 100,
    });

    const raw = result as any;
    const reply = (raw.response ?? raw.choices?.[0]?.message?.content ?? "").trim();
    return respond({ reply }, "ok", 1, origin);

  } catch (e: any) {
    const errStr = JSON.stringify(e?.message || e?.toString() || e);
    if (errStr.includes("3036") || errStr.includes("used up") || errStr.includes("limit")) {
      console.warn("AI 额度用尽", { module: "chat", action: "quota_exhausted", character, mode: modeKey });
      const msgs = (QUOTA_MSGS[modeKey]?.[ch] ?? QUOTA_MSGS.chat.Ava);
      return respond({ reply: msgs[Math.floor(Math.random() * msgs.length)] }, "ok", 1, origin);
    }
    console.error("AI 聊天异常", { module: "chat", action: "handler_error", error: e.message });
    return respond({ error: e.message }, "AI error", 0, origin);
  }
}
