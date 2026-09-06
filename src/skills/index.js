const contentSkill = require("./content");
const videoSkill = require("./video");
const thumbnailSkill = require("./thumbnail");
const newsSkill = require("./news");

const skills = {
  content: contentSkill,
  video: videoSkill,
  thumbnail: thumbnailSkill,
  news: newsSkill
};

function detectSkill(text = "") {
  const value = text.toLowerCase().trim();

  // الأخبار
  if (
    value.includes("خبر") ||
    value.includes("أخبار") ||
    value.includes("اخبار") ||
    value.includes("عاجل") ||
    value.includes("بيان") ||
    value.includes("مصدر") ||
    value.includes("خبر عاجل")
  ) {
    return "news";
  }

  // الفيديو والمونتاج
  if (
    value.includes("فيديو") ||
    value.includes("مونتاج") ||
    value.includes("ريلز") ||
    value.includes("reels") ||
    value.includes("shorts") ||
    value.includes("تيك توك") ||
    value.includes("tiktok")
  ) {
    return "video";
  }

  // الصور المصغرة والتصميم
  if (
    value.includes("صورة مصغرة") ||
    value.includes("thumbnail") ||
    value.includes("ثامبنيل") ||
    value.includes("تصميم") ||
    value.includes("غلاف")
  ) {
    return "thumbnail";
  }

  // صناعة المحتوى
  if (
    value.includes("محتوى") ||
    value.includes("منشور") ||
    value.includes("بوست") ||
    value.includes("فكرة") ||
    value.includes("كابشن") ||
    value.includes("هاشتاق") ||
    value.includes("هاشتاقات")
  ) {
    return "content";
  }

  return null;
}

module.exports = {
  skills,
  detectSkill
};
