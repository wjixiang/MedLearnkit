export function hasNullValue(obj) {
  // 检查对象是否为 null
  if (obj === null) {
    return true;
  }

  // 检查对象是否为数组
  if (Array.isArray(obj)) {
    return obj.some(hasNullValue); // 对数组中的每个元素递归检查
  }

  // 检查对象的每个属性
  if (typeof obj === "object" && obj !== null) {
    console.log(obj);
    return Object.values(obj).some(hasNullValue); // 对对象的每个值递归检查
  }

  // 如果不是对象或数组，返回 false
  return false;
}