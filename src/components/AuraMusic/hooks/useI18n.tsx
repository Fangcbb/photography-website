import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "en" | "zh";

interface Dict {
  app: {
    name: string;
    welcome: string;
    selectSong: string;
    importFail: string;
    importOk: (count: number) => string;
  };
  about: {
    descStart: string;
    descEmphasis: string;
    descEnd: string;
    viewGitHub: string;
    createdBy: string;
    done: string;
  };
  top: {
    search: string;
    importLocal: string;
    about: string;
    enterFullscreen: string;
    exitFullscreen: string;
  };
  controls: {
    albumArt: string;
    noMusic: string;
    settings: string;
    playback: string;
    previous: string;
    next: string;
    queue: string;
    speed: string;
    tone: string;
    vinylMode: string;
    digital: string;
    vinyl: string;
    digitalShort: string;
    vinylShort: string;
  };
  import: {
    title: string;
    hintStart: string;
    hintBrand: string;
    hintEnd: string;
    placeholder: string;
    cancel: string;
    action: string;
    loading: string;
  };
  keys: {
    title: string;
    subtitle: string;
    playPause: string;
    loop: string;
    seek: string;
    prevNext: string;
    volume: string;
    volumeDialog: string;
    speedDialog: string;
    search: string;
    playlist: string;
    toggle: string;
    press: string;
    close: string;
  };
  lyrics: {
    syncing: string;
    empty: string;
  };
  list: {
    playingNext: string;
    songs: (count: number) => string;
    selectAll: string;
    deleteSelected: string;
    done: string;
    addFromUrl: string;
    edit: string;
    empty: string;
    drag: string;
    reorder: (title: string) => string;
  };
  search: {
    online: string;
    queue: string;
    emptyQueue: string;
    press: string;
    toSearch: string;
    noMatches: string;
    loading: string;
    searchCloud: string;
    cloud: string;
    more: string;
    playNow: string;
    addToQueue: string;
    queueLabel: string;
    cloudLabel: string;
  };
  playlist: {
    invalidUrl: string;
    unknownArtist: string;
  };
  bg: {
    loading: string;
  };
}

const enDict: Dict = {
  app: {
    name: "FangC Music",
    welcome: "Welcome to Aura Music",
    selectSong: "Please select a song first",
    importFail: "Import failed",
    importOk: (count) => `Successfully imported ${count} songs`,
  },
  about: {
    descStart: "A pure web music player with ",
    descEmphasis: "WebGL fluid background & Canvas lyric visualisation",
    descEnd: ", powered by NetEase Cloud Music API.",
    viewGitHub: "View on GitHub",
    createdBy: "Created by dingyi222666",
    done: "Done",
  },
  top: {
    search: "Search",
    importLocal: "Import Local Music",
    about: "About",
    enterFullscreen: "Enter Fullscreen",
    exitFullscreen: "Exit Fullscreen",
  },
  controls: {
    albumArt: "Album Art",
    noMusic: "No music playing",
    settings: "Settings",
    playback: "Playback",
    previous: "Previous",
    next: "Next",
    queue: "Queue",
    speed: "Speed",
    tone: "Tone",
    vinylMode: "Mode",
    digital: "Digital",
    vinyl: "Vinyl",
    digitalShort: "Dig",
    vinylShort: "Vin",
  },
  import: {
    title: "Import from URL",
    hintStart: "Supports ",
    hintBrand: "NetEase",
    hintEnd: " links or song IDs",
    placeholder: "Paste link or ID...",
    cancel: "Cancel",
    action: "Import",
    loading: "Importing...",
  },
  keys: {
    title: "Keyboard Shortcuts",
    subtitle: "All shortcuts below require the page to be focused.",
    playPause: "Play / Pause",
    loop: "Toggle loop mode",
    seek: "Seek ±5s",
    prevNext: "Previous / Next",
    volume: "Volume ±5%",
    volumeDialog: "Volume slider",
    speedDialog: "Speed & Pitch dialog",
    search: "Search dialog",
    playlist: "Playlist",
    toggle: "Toggle",
    press: "Press",
    close: "Close",
  },
  lyrics: {
    syncing: "Syncing",
    empty: "No lyrics available",
  },
  list: {
    playingNext: "Playing Next",
    songs: (count) => `${count} songs`,
    selectAll: "Select All",
    deleteSelected: "Delete Selected",
    done: "Done",
    addFromUrl: "Add from URL",
    edit: "Edit",
    empty: "Your queue is empty",
    drag: "Drag to reorder",
    reorder: (title) => `Reorder ${title}`,
  },
  search: {
    online: "Search online songs...",
    queue: "Filter queue...",
    emptyQueue: "No songs in queue",
    press: "Press",
    toSearch: "to search",
    noMatches: "No matches found",
    loading: "Searching...",
    searchCloud: "Search Cloud Music",
    cloud: "Cloud",
    more: "Scroll to load more",
    playNow: "Play Now",
    addToQueue: "Add to Queue",
    queueLabel: "Queue",
    cloudLabel: "Cloud Music",
  },
  playlist: {
    invalidUrl:
      "Invalid NetEase link. Use https://music.163.com/#/song?id=... or playlist link",
    unknownArtist: "Unknown Artist",
  },
  bg: {
    loading: "Loading background layer...",
  },
};

const zhDict: Dict = {
  app: {
    name: "FangC 音乐",
    welcome: "欢迎使用 Aura Music",
    selectSong: "请先选择歌曲",
    importFail: "导入失败",
    importOk: (count) => `成功导入 ${count} 首歌曲`,
  },
  about: {
    descStart: "一个纯净的网页音乐播放器，拥有",
    descEmphasis: "WebGL 流体背景 & Canvas 歌词可视化",
    descEnd: "，由网易云音乐 API 驱动。",
    viewGitHub: "在 GitHub 上查看",
    createdBy: "由 dingyi222666 创建",
    done: "完成",
  },
  top: {
    search: "搜索",
    importLocal: "导入本地音乐",
    about: "关于",
    enterFullscreen: "进入全屏",
    exitFullscreen: "退出全屏",
  },
  controls: {
    albumArt: "专辑封面",
    noMusic: "未播放音乐",
    settings: "设置",
    playback: "播放",
    previous: "上一首",
    next: "下一首",
    queue: "队列",
    speed: "速度",
    tone: "音调",
    vinylMode: "模式",
    digital: "数字",
    vinyl: "黑胶",
    digitalShort: "数字",
    vinylShort: "黑胶",
  },
  import: {
    title: "从链接导入",
    hintStart: "支持 ",
    hintBrand: "网易云音乐",
    hintEnd: " 链接或歌曲 ID",
    placeholder: "粘贴链接或 ID...",
    cancel: "取消",
    action: "导入",
    loading: "导入中...",
  },
  keys: {
    title: "键盘快捷键",
    subtitle: "所有快捷键需要页面处于焦点状态。",
    playPause: "播放 / 暂停",
    loop: "切换循环模式",
    seek: "快进/后退 ±5 秒",
    prevNext: "上一首 / 下一首",
    volume: "音量 ±5%",
    volumeDialog: "音量滑块",
    speedDialog: "速度与音调对话框",
    search: "搜索对话框",
    playlist: "播放列表",
    toggle: "切换",
    press: "按下",
    close: "关闭",
  },
  lyrics: {
    syncing: "同步中",
    empty: "暂无歌词",
  },
  list: {
    playingNext: "即将播放",
    songs: (count) => `${count} 首歌曲`,
    selectAll: "全选",
    deleteSelected: "删除选中",
    done: "完成",
    addFromUrl: "从链接添加",
    edit: "编辑",
    empty: "播放列表为空",
    drag: "拖动以重新排序",
    reorder: (title) => `重新排序 ${title}`,
  },
  search: {
    online: "搜索在线歌曲...",
    queue: "筛选队列...",
    emptyQueue: "队列中暂无歌曲",
    press: "按",
    toSearch: "搜索",
    noMatches: "未找到匹配结果",
    loading: "搜索中...",
    searchCloud: "搜索云音乐",
    cloud: "云",
    more: "滚动加载更多",
    playNow: "立即播放",
    addToQueue: "加入队列",
    queueLabel: "当前队列",
    cloudLabel: "云音乐",
  },
  playlist: {
    invalidUrl:
      "无效的网易云链接。请使用 https://music.163.com/#/song?id=... 或歌单链接",
    unknownArtist: "未知歌手",
  },
  bg: {
    loading: "背景层加载中...",
  },
};

const dicts: Record<Lang, Dict> = { en: enDict, zh: zhDict };

export const pickLang = (
  langs?: readonly string[] | null,
  lang?: string | null,
): Lang => {
  const list = [...(langs ?? []), lang ?? ""]
    .filter(Boolean)
    .map((item) => item.toLowerCase());

  for (const item of list) {
    if (item.startsWith("zh")) {
      return "zh";
    }

    if (item.startsWith("en")) {
      return "en";
    }
  }

  return "zh"; // Default to Chinese for FangC
};

export const detectLang = (): Lang => {
  if (typeof navigator === "undefined") {
    return "zh"; // Default to Chinese for SSR
  }

  return pickLang(navigator.languages, navigator.language);
};

interface Ctx {
  lang: Lang;
  setLang: React.Dispatch<React.SetStateAction<Lang>>;
  dict: Dict;
}

const I18nContext = createContext<Ctx | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLang] = useState<Lang>(() => detectLang());

  useEffect(() => {
    const sync = () => setLang(detectLang());
    window.addEventListener("languagechange", sync);
    return () => window.removeEventListener("languagechange", sync);
  }, []);

  const dict = useMemo(() => dicts[lang], [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    // Don't override document.title as it conflicts with Next.js
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, dict }), [dict, lang]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);

  if (!ctx) {
    // Return default Chinese dict when not in provider
    return {
      lang: "zh" as Lang,
      setLang: () => {},
      dict: zhDict,
    };
  }

  return ctx;
};
