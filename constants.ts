import { TranslationMatrix } from './types';

export const UI_LABELS: TranslationMatrix = {
  title: {
    en: "Global Supplier Survey",
    sc: "全球供应商调查",
    tc: "全球供應商調查",
  },
  subtitle: {
    en: "Please complete the following details regarding your manufacturing capabilities.",
    sc: "请填写以下关于贵司生产能力的详细信息。",
    tc: "請填寫以下關於貴司生產能力的詳細資訊。",
  },
  submit: {
    en: "Submit Survey",
    sc: "提交调查",
    tc: "提交調查",
  },
  submitting: {
    en: "Submitting...",
    sc: "提交中...",
    tc: "提交中...",
  },
  success: {
    en: "Survey submitted successfully!",
    sc: "调查提交成功！",
    tc: "調查提交成功！",
  },
  required_error: {
    en: "This field is required.",
    sc: "此项为必填项。",
    tc: "此欄位為必填。",
  },
  section_a: { en: "A. Business Type", sc: "A. 业务类型", tc: "A. 業務類型" },
  section_b: { en: "B. Raw Materials", sc: "B. 原材料 (纱线)", tc: "B. 原材料 (紗線)" },
  section_c: { en: "C. Fabric Construction", sc: "C. 面料结构", tc: "C. 面料結構" },
  section_d: { en: "D. Dyeing & Printing", sc: "D. 染色与印花", tc: "D. 染色與印花" },
  section_e: { en: "E. Finishing (Performance)", sc: "E. 后整理 (功能性)", tc: "E. 後整理 (功能性)" },
  section_f: { en: "F. Lead Times & Metrics", sc: "F. 交期与指标", tc: "F. 交期與指標" },
  section_g: { en: "G. Patents & Comments", sc: "G. 专利与备注", tc: "G. 專利與備註" },
  comments_placeholder: { 
    en: "List any patents or additional comments here...", 
    sc: "在此列出任何专利或额外备注...", 
    tc: "在此列出任何專利或額外備註..." 
  },
  days: { en: "Days", sc: "天", tc: "天" },
};

export const DATA_KEYS: TranslationMatrix = {
  // Section A
  biz_vertical: { en: "Vertical Mill", sc: "垂直整合工厂 (纺纱-织造-染整)", tc: "垂直整合工廠 (紡紗-織造-染整)" },
  biz_mill: { en: "Fabric Mill (Knitting/Weaving)", sc: "面料厂 (织造为主)", tc: "面料廠 (織造為主)" },
  biz_dye: { en: "Dye House / Finisher", sc: "染整厂", tc: "染整廠" },
  biz_trade: { en: "Converter / Trading Co.", sc: "贸易公司 / 转换商", tc: "貿易公司 / 轉換商" },

  // Section B
  mat_cotton: { en: "Cotton", sc: "棉", tc: "棉" },
  mat_poly: { en: "Polyester", sc: "聚酯纤维 (涤纶)", tc: "聚酯纖維" },
  mat_nylon: { en: "Nylon / Polyamide", sc: "尼龙 (锦纶)", tc: "尼龍" },
  mat_cv: { en: "Viscose / Rayon", sc: "粘胶 / 人造棉", tc: "嫘縈 / 人造絲" },
  mat_tencel: { en: "Lyocell (Tencel)", sc: "莱赛尔 (天丝)", tc: "萊賽爾 (天絲)" },
  mat_wool: { en: "Wool", sc: "羊毛", tc: "羊毛" },
  mat_spandex: { en: "Spandex / Elastane", sc: "氨纶 (莱卡)", tc: "彈性纖維 (Op/Spandex)" },
  mat_recycle: { en: "Recycled (GRS)", sc: "再生 / 回收材料 (GRS)", tc: "環保回收材質 (GRS)" },

  // Section C
  type_knit: { en: "Knits", sc: "针织", tc: "針織" },
  type_woven: { en: "Wovens", sc: "梭织 (机织)", tc: "平織 / 梭織" },
  knit_jersey: { en: "Single Jersey", sc: "单面汗布", tc: "單面布" },
  knit_rib: { en: "Rib / Interlock", sc: "罗纹 / 双面布", tc: "羅紋 / 雙面布" },
  knit_fleece: { en: "French Terry / Fleece", sc: "卫衣布 / 抓毛布", tc: "毛圈布 / 刷毛布" },
  knit_jacquard: { en: "Jacquard", sc: "提花", tc: "提花" },
  wov_poplin: { en: "Poplin / Shirting", sc: "府绸 / 衬衫布", tc: "府綢 / 襯衫布" },
  wov_twill: { en: "Twill / Chino", sc: "斜纹布", tc: "斜紋布" },
  wov_canvas: { en: "Canvas / Heavy", sc: "帆布 / 厚重织物", tc: "帆布 / 厚重織物" },

  // Section D
  dye_piece: { en: "Piece Dye (Solid)", sc: "匹染 (缸染)", tc: "匹染 (缸染)" },
  dye_yarn: { en: "Yarn Dye", sc: "色织 (纱染)", tc: "色織 (先染後織)" },
  dye_dope: { en: "Solution Dye / Dope Dye", sc: "原液着色 (无水染色)", tc: "原液染色 (無水染色)" },
  print_screen: { en: "Rotary / Flat Screen", sc: "圆网 / 平网印花", tc: "圓網 / 平網印花" },
  print_digital: { en: "Digital Print", sc: "数码印花", tc: "數位印花" },
  print_sub: { en: "Sublimation", sc: "热转移印花", tc: "熱昇華轉印" },

  // Section E
  fin_brush: { en: "Brushing / Peaching", sc: "磨毛 / 抓毛", tc: "磨毛 / 刷毛" },
  fin_wick: { en: "Wicking / Quick Dry", sc: "吸湿排汗", tc: "吸濕排汗" },
  fin_dwr: { en: "Water Repellent (DWR)", sc: "防泼水", tc: "防潑水" },
  fin_wp: { en: "Waterproof (Coating)", sc: "防水 (涂层/贴膜)", tc: "防水 (塗層/貼膜)" },
  fin_anti_bac: { en: "Anti-bacterial", sc: "抗菌", tc: "抗菌" },
  fin_uv: { en: "UV Protection", sc: "抗紫外线", tc: "抗紫外線" },
  fin_wrinkle: { en: "Wrinkle Free", sc: "以此免烫 / 抗皱", tc: "免燙 / 抗皺" },

  // Section F Keys
  time_labdip: { en: "Lab Dip Turnaround", sc: "色样打样时间 (天)", tc: "色樣打樣時間 (天)" },
  time_strike: { en: "Strike-off Turnaround", sc: "印花手样时间 (天)", tc: "印花手刮樣時間 (天)" },
  time_sample: { en: "Sample Yardage Lead Time", sc: "米样/样布交期 (天)", tc: "樣布交期 (天)" },
  inv_greige: { en: "Hold Greige Inventory?", sc: "是否备有坯布库存?", tc: "是否備有胚布庫存?" },
  
  // Section F Options
  opt_yes: { en: "Yes", sc: "是", tc: "是" },
  opt_no: { en: "No", sc: "否", tc: "否" },
  opt_limited: { en: "Limited / Partial", sc: "部分 / 有限", tc: "部分 / 有限" },
};