// src/services/TTSEngine.ts
var TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
var VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_TOKEN}`;
var CACHE_TTL = 24 * 60 * 60 * 1e3;
var OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
var TOKEN_REFRESH_BEFORE_EXPIRY = 3 * 60;
var ENDPOINT_URL = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
var SIGN_KEY_B64 = "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0";
var TTS_STYLES = [
  "general",
  "assistant",
  "chat",
  "customerservice",
  "newscast",
  "affectionate",
  "calm",
  "cheerful",
  "gentle",
  "lyrical",
  "serious"
];
var PRESET_VOICES = [
  { name: "zh-CN-XiaoxiaoNeural", displayName: "\u6653\u6653 (\u5973\u58F0\xB7\u6E29\u67D4)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-YunxiNeural", displayName: "\u4E91\u5E0C (\u7537\u58F0\xB7\u6E05\u6717)", locale: "zh-CN", gender: "Male" },
  { name: "zh-CN-YunyangNeural", displayName: "\u4E91\u626C (\u7537\u58F0\xB7\u9633\u5149)", locale: "zh-CN", gender: "Male" },
  { name: "zh-CN-XiaoyiNeural", displayName: "\u6653\u4F0A (\u5973\u58F0\xB7\u751C\u7F8E)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-YunjianNeural", displayName: "\u4E91\u5065 (\u7537\u58F0\xB7\u7A33\u91CD)", locale: "zh-CN", gender: "Male" },
  { name: "zh-CN-XiaochenNeural", displayName: "\u6653\u8FB0 (\u5973\u58F0\xB7\u77E5\u6027)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaohanNeural", displayName: "\u6653\u6DB5 (\u5973\u58F0\xB7\u4F18\u96C5)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaomengNeural", displayName: "\u6653\u68A6 (\u5973\u58F0\xB7\u68A6\u5E7B)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaomoNeural", displayName: "\u6653\u58A8 (\u5973\u58F0\xB7\u6587\u827A)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaoqiuNeural", displayName: "\u6653\u79CB (\u5973\u58F0\xB7\u6210\u719F)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaoruiNeural", displayName: "\u6653\u777F (\u5973\u58F0\xB7\u667A\u6167)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaoshuangNeural", displayName: "\u6653\u53CC (\u5973\u58F0\xB7\u6D3B\u6CFC)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaoxuanNeural", displayName: "\u6653\u8431 (\u5973\u58F0\xB7\u6E05\u65B0)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaoyanNeural", displayName: "\u6653\u989C (\u5973\u58F0\xB7\u67D4\u7F8E)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaoyouNeural", displayName: "\u6653\u60A0 (\u5973\u58F0\xB7\u60A0\u626C)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-XiaozhenNeural", displayName: "\u6653\u7504 (\u5973\u58F0\xB7\u7AEF\u5E84)", locale: "zh-CN", gender: "Female" },
  { name: "zh-CN-YunfengNeural", displayName: "\u4E91\u67AB (\u7537\u58F0\xB7\u78C1\u6027)", locale: "zh-CN", gender: "Male" },
  { name: "zh-CN-YunhaoNeural", displayName: "\u4E91\u7693 (\u7537\u58F0\xB7\u8C6A\u8FC8)", locale: "zh-CN", gender: "Male" },
  { name: "zh-CN-YunxiaNeural", displayName: "\u4E91\u590F (\u7537\u58F0\xB7\u70ED\u60C5)", locale: "zh-CN", gender: "Male" },
  { name: "zh-CN-YunyeNeural", displayName: "\u4E91\u91CE (\u7537\u58F0\xB7\u91CE\u6027)", locale: "zh-CN", gender: "Male" },
  { name: "zh-CN-YunzeNeural", displayName: "\u4E91\u6CFD (\u7537\u58F0\xB7\u6DF1\u6C89)", locale: "zh-CN", gender: "Male" }
];
var toArrayBuffer = (buf) => {
  if (buf instanceof ArrayBuffer) return buf;
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
};
var voiceCache = null;
var onlineVoiceTask = null;
var localVoiceTask = null;
var localVoiceCache = null;
var tokenInfo = { endpoint: null, token: "", expiredAt: 0 };
var readVoiceCache = () => {
  if (voiceCache) return voiceCache;
  try {
    return voiceCache = JSON.parse(localStorage.getItem("sireader:tts:voices") || "null");
  } catch {
    return null;
  }
};
var writeVoiceCache = (voices) => {
  voiceCache = { at: Date.now(), voices };
  try {
    localStorage.setItem("sireader:tts:voices", JSON.stringify(voiceCache));
  } catch {
  }
};
async function loadOnlineVoices() {
  const cached = readVoiceCache();
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.voices;
  if (onlineVoiceTask) return onlineVoiceTask;
  onlineVoiceTask = (async () => {
    try {
      const res = await fetch(VOICES_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const voices = data.map((v) => ({
        name: v.ShortName || v.Name,
        displayName: v.FriendlyName || v.DisplayName || v.ShortName,
        locale: v.Locale,
        gender: v.Gender === "Male" ? "Male" : "Female",
        isLocal: false
      }));
      writeVoiceCache(voices);
      return voices;
    } catch {
      return cached?.voices?.length ? cached.voices : PRESET_VOICES;
    }
  })().finally(() => {
    onlineVoiceTask = null;
  });
  return onlineVoiceTask;
}
async function loadLocalVoices() {
  if (!("speechSynthesis" in window)) return [];
  if (localVoiceCache) return localVoiceCache;
  if (localVoiceTask) return localVoiceTask;
  localVoiceTask = (async () => {
    let voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      voices = await new Promise((resolve) => {
        const handler = () => {
          const v = window.speechSynthesis.getVoices();
          if (v.length) {
            window.speechSynthesis.removeEventListener("voiceschanged", handler);
            resolve(v);
          }
        };
        window.speechSynthesis.addEventListener("voiceschanged", handler);
        setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", handler);
          resolve(window.speechSynthesis.getVoices());
        }, 800);
      });
    }
    return localVoiceCache = voices.map((v) => ({
      name: v.name,
      displayName: v.name,
      locale: v.lang || "",
      gender: "Female",
      isLocal: true
    }));
  })().finally(() => {
    localVoiceTask = null;
  });
  return localVoiceTask;
}
var escapeXmlText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
var plainTextFromSSML = (input) => {
  if (!input?.trim()) return "";
  try {
    if (input.includes("<") && typeof DOMParser !== "undefined") {
      const el = new DOMParser().parseFromString(input, "application/xml").documentElement;
      if (el && el.localName !== "parsererror" && !el.querySelector("parsererror")) {
        return (el.textContent || "").replace(/\s+/g, " ").trim();
      }
    }
  } catch {
  }
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};
var formatRate = (rate = 1) => {
  const n = Math.round((rate - 1) * 100);
  return `${n >= 0 ? "+" : ""}${n}%`;
};
var formatPitchHz = (pitchHz = 0) => {
  const n = Math.round(Number(pitchHz) || 0);
  return `${n >= 0 ? "+" : ""}${n}Hz`;
};
var formatVolume = (volume = 0) => {
  const n = Math.round(Number(volume) || 0);
  return `${n >= 0 ? "+" : ""}${n}%`;
};
var getSsml = (text, voiceName, rate, pitch, volume, style) => {
  const escaped = escapeXmlText(text);
  const safeStyle = TTS_STYLES.includes(style) ? style : "general";
  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">
  <voice name="${voiceName}">
    <mstts:express-as style="${safeStyle}" styledegree="2.0" role="default">
      <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escaped}</prosody>
    </mstts:express-as>
  </voice>
</speak>`;
};
var uuid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/-/g, "");
var dateFormat = () => `${(/* @__PURE__ */ new Date()).toUTCString().replace(/GMT/, "").trim()} GMT`.toLowerCase();
var base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
var bytesToBase64 = (bytes) => {
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
};
var hmacSha256 = async (key, data) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto is unavailable");
  const cryptoKey = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)));
};
var sign = async (urlStr) => {
  const url = urlStr.split("://")[1];
  const encodedUrl = encodeURIComponent(url);
  const uuidStr = uuid();
  const formattedDate = dateFormat();
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
  const key = base64ToBytes(SIGN_KEY_B64);
  const signData = await hmacSha256(key, bytesToSign);
  return `MSTranslatorAndroidApp::${bytesToBase64(signData)}::${formattedDate}::${uuidStr}`;
};
async function getEndpoint() {
  const now = Date.now() / 1e3;
  if (tokenInfo.token && tokenInfo.expiredAt && now < tokenInfo.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
    return tokenInfo.endpoint;
  }
  const clientId = uuid();
  try {
    const response = await fetch(ENDPOINT_URL, {
      method: "POST",
      headers: {
        "Accept-Language": "zh-Hans",
        "X-ClientVersion": "4.0.530a 5fe1dc6c",
        "X-UserId": "0f04d16a175c411e",
        "X-HomeGeographicRegion": "zh-Hans-CN",
        "X-ClientTraceId": clientId,
        "X-MT-Signature": await sign(ENDPOINT_URL),
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": "0"
      }
    });
    if (!response.ok) throw new Error(`\u83B7\u53D6 endpoint \u5931\u8D25: ${response.status}`);
    const data = await response.json();
    const jwt = data.t.split(".")[1];
    const decodedJwt = JSON.parse(atob(jwt));
    tokenInfo = { endpoint: data, token: data.t, expiredAt: decodedJwt.exp };
    return data;
  } catch (error) {
    if (tokenInfo.token) return tokenInfo.endpoint;
    throw error;
  }
}
var EdgeTTSCore = class {
  voice = "zh-CN-XiaoxiaoNeural";
  setVoice(voice) {
    if (voice) this.voice = voice;
  }
  close() {
  }
  async toStream(text, rate = 1, pitchHz = 0, volume = 0, style = "general") {
    return this.synthesize(plainTextFromSSML(text) || text, rate, pitchHz, volume, style);
  }
  async toSSMLStream(ssml, rate = 1, pitchHz = 0, volume = 0, style = "general") {
    const text = plainTextFromSSML(ssml);
    if (!text) throw new Error("TTS \u6587\u672C\u4E3A\u7A7A");
    return this.synthesize(text, rate, pitchHz, volume, style);
  }
  async synthesize(text, rate = 1, pitchHz = 0, volume = 0, style = "general", maxRetries = 3) {
    const clean = text.trim();
    if (!clean) throw new Error("TTS \u6587\u672C\u4E3A\u7A7A");
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const endpoint = await getEndpoint();
        const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: endpoint.t,
            "Content-Type": "application/ssml+xml",
            "User-Agent": USER_AGENT,
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT
          },
          body: getSsml(clean, this.voice, formatRate(rate), formatPitchHz(pitchHz), formatVolume(volume), style)
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          throw new Error(`Edge TTS API \u9519\u8BEF: ${response.status} ${errorText}`);
        }
        const buf = new Uint8Array(await response.arrayBuffer());
        if (!buf.length) throw new Error("No audio");
        return buf;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries && /fetch|network|Failed to fetch|endpoint/i.test(lastError.message)) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        if (attempt === maxRetries) break;
      }
    }
    throw lastError || new Error("TTS \u5408\u6210\u5931\u8D25");
  }
};
export {
  EdgeTTSCore,
  PRESET_VOICES,
  TTS_STYLES,
  loadLocalVoices,
  loadOnlineVoices,
  plainTextFromSSML,
  toArrayBuffer
};
