(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPS_PROFIT_ANALYSIS = factory();
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function safeQuantity(value) {
    const quantity = numberOrNull(value);
    return quantity != null && quantity > 0 ? quantity : 1;
  }

  function normalizeSkuKey(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function findShippingFee(weightGrams, tiers) {
    const weight = numberOrNull(weightGrams);
    if (weight == null || weight < 0 || !Array.isArray(tiers) || !tiers.length) return null;
    const tier = tiers.find((entry) => {
      const lower = numberOrNull(entry?.lo) ?? 0;
      const upper = entry?.hi === Infinity ? Infinity : numberOrNull(entry?.hi);
      return upper != null && weight >= lower && weight <= upper;
    });
    return tier ? numberOrNull(tier.net) : null;
  }

  function isIncludedOrderStatus(value) {
    const status = String(value ?? "").trim();
    return !/取消|cancel(?:led|ed)?/i.test(status);
  }

  function deriveTransactionAmounts(input) {
    const source = input || {};
    const quantity = safeQuantity(source.quantity);
    const listAmount = numberOrNull(source.subtotalBeforeDiscount);
    const sellerDiscount = numberOrNull(source.sellerDiscount);
    const exportedAfterDiscount = numberOrNull(source.subtotalAfterDiscount);
    const explicitPlatformSubsidy = numberOrNull(source.platformDiscount);
    const exact = listAmount != null && sellerDiscount != null;

    if (!exact) {
      const sellerRevenue = exportedAfterDiscount;
      return {
        listAmount,
        sellerDiscount,
        platformSubsidy: explicitPlatformSubsidy,
        sellerRevenue,
        buyerPaidAmount: exportedAfterDiscount,
        subtotalAfterDiscount: exportedAfterDiscount,
        sellerUnitPrice: sellerRevenue == null ? null : sellerRevenue / quantity,
        buyerUnitPrice: exportedAfterDiscount == null ? null : exportedAfterDiscount / quantity,
        platformSubsidyPerUnit: explicitPlatformSubsidy == null ? null : explicitPlatformSubsidy / quantity,
        equationGap: null,
        basis: "after-discount-fallback",
        exact: false,
      };
    }

    const sellerRevenue = Math.max(0, listAmount - sellerDiscount);
    const platformSubsidy = explicitPlatformSubsidy != null
      ? Math.max(0, explicitPlatformSubsidy)
      : exportedAfterDiscount == null ? null : Math.max(0, sellerRevenue - exportedAfterDiscount);
    const buyerPaidAmount = exportedAfterDiscount != null
      ? exportedAfterDiscount
      : platformSubsidy == null ? null : Math.max(0, sellerRevenue - platformSubsidy);
    const expectedBuyerAmount = platformSubsidy == null ? null : sellerRevenue - platformSubsidy;

    return {
      listAmount,
      sellerDiscount,
      platformSubsidy,
      sellerRevenue,
      buyerPaidAmount,
      subtotalAfterDiscount: exportedAfterDiscount,
      sellerUnitPrice: sellerRevenue / quantity,
      buyerUnitPrice: buyerPaidAmount == null ? null : buyerPaidAmount / quantity,
      platformSubsidyPerUnit: platformSubsidy == null ? null : platformSubsidy / quantity,
      equationGap: expectedBuyerAmount == null || exportedAfterDiscount == null ? null : exportedAfterDiscount - expectedBuyerAmount,
      basis: "before-minus-seller",
      exact: true,
    };
  }

  function calculateProfit(input) {
    const source = input || {};
    const sellerRevenue = numberOrNull(source.sellerRevenue);
    const productCost = numberOrNull(source.productCost);
    const grossProfit = sellerRevenue == null || productCost == null ? null : sellerRevenue - productCost;
    const grossMargin = grossProfit == null || sellerRevenue <= 0 ? null : grossProfit / sellerRevenue;
    const deductionNames = ["fixedPlatformFee", "affiliateFee", "adCost", "shippingCost", "staffCost"];
    const deductions = deductionNames.map((name) => numberOrNull(source[name]));
    const hasNetInputs = grossProfit != null && deductions.every((value) => value != null);
    const totalOperatingDeductions = hasNetInputs ? deductions.reduce((sum, value) => sum + value, 0) : null;
    const netProfit = totalOperatingDeductions == null ? null : grossProfit - totalOperatingDeductions;
    const netMargin = netProfit == null || sellerRevenue <= 0 ? null : netProfit / sellerRevenue;
    return { grossProfit, grossMargin, totalOperatingDeductions, netProfit, netMargin };
  }

  function calculateBreakevenPrice(input) {
    const source = input || {};
    const unitCost = numberOrNull(source.unitCost);
    const shippingUnit = numberOrNull(source.shippingUnit);
    const variableRate = numberOrNull(source.variableRate);
    if (unitCost == null || shippingUnit == null || variableRate == null || variableRate < 0 || variableRate >= 1) return null;
    return (unitCost + shippingUnit) / (1 - variableRate);
  }

  function difference(left, right) {
    const a = numberOrNull(left);
    const b = numberOrNull(right);
    return a == null || b == null ? null : a - b;
  }

  function meaningfulGap(value, base) {
    if (value == null) return false;
    const tolerance = Math.max(0.5, Math.abs(Number(base) || 0) * 0.01);
    return Math.abs(value) > tolerance;
  }

  function assessPriceRisk(input) {
    const source = input || {};
    const reasons = [];
    const exactRevenue = source.exactRevenue === true;
    const hasCost = source.hasCost === true;
    const shippingKnown = source.shippingKnown === true;
    const sellerUnitPrice = numberOrNull(source.sellerUnitPrice);
    const buyerUnitPrice = numberOrNull(source.buyerUnitPrice);
    const platformSubsidyPerUnit = numberOrNull(source.platformSubsidyPerUnit);
    const activityPrice = numberOrNull(source.activityPrice);
    const suggestedRetailPrice = numberOrNull(source.suggestedRetailPrice);
    const breakevenPrice = numberOrNull(source.breakevenPrice);
    const netMargin = numberOrNull(source.netMargin);
    const equationGap = numberOrNull(source.equationGap);
    const targetMargin = numberOrNull(source.targetMargin) ?? 0.05;
    const activityGap = difference(sellerUnitPrice, activityPrice);
    const expectedBuyerAtActivity = activityPrice == null || platformSubsidyPerUnit == null
      ? null
      : activityPrice - platformSubsidyPerUnit;
    const buyerActivityGap = difference(buyerUnitPrice, expectedBuyerAtActivity);
    const targetPriceGap = difference(sellerUnitPrice, suggestedRetailPrice);
    const priceDetails = { activityGap, buyerActivityGap, targetPriceGap };

    if (!exactRevenue) reasons.push("订单缺少原始折扣字段，请重新导入含 Before Discount 与 Seller Discount 的明细");
    if (!hasCost) reasons.push("SKU 成本待导入或待匹配");
    if (!shippingKnown) reasons.push("重量或运费阶梯缺失，净利无法完整核算");
    if (reasons.length) {
      return Object.assign({ level: "pending", label: "待补数据", reasons }, priceDetails);
    }

    if (sellerUnitPrice != null && breakevenPrice != null && sellerUnitPrice < breakevenPrice) {
      reasons.push(`商家成交单价低于保本价 ${Math.abs(sellerUnitPrice - breakevenPrice).toFixed(2)}฿`);
    }
    if (netMargin != null && netMargin < 0) reasons.push(`净利率 ${(netMargin * 100).toFixed(1)}%，已经亏损`);
    if (reasons.length) return Object.assign({ level: "loss", label: "亏损风险", reasons }, priceDetails);

    const anomalyReasons = [];
    if (equationGap != null && Math.abs(equationGap) > 0.01) anomalyReasons.push(`折扣等式相差 ${Math.abs(equationGap).toFixed(2)}฿`);
    if (meaningfulGap(activityGap, activityPrice)) {
      anomalyReasons.push(`商家成交单价与活动价相差 ${Math.abs(activityGap).toFixed(2)}฿`);
    }
    if (meaningfulGap(buyerActivityGap, activityPrice)) {
      anomalyReasons.push(`买家商品实付与「活动价减平台补贴」相差 ${Math.abs(buyerActivityGap).toFixed(2)}฿`);
    }
    if (anomalyReasons.length) return Object.assign({ level: "anomaly", label: "价格异常", reasons: anomalyReasons }, priceDetails);

    if (netMargin != null && netMargin < targetMargin) {
      const lowMarginReasons = [`净利率 ${(netMargin * 100).toFixed(1)}%，低于目标 ${(targetMargin * 100).toFixed(1)}%`];
      if (meaningfulGap(targetPriceGap, suggestedRetailPrice) && targetPriceGap < 0) {
        lowMarginReasons.push(`商家成交单价低于建议零售价（目标价）${Math.abs(targetPriceGap).toFixed(2)}฿`);
      }
      return Object.assign({
        level: "low-margin",
        label: "低利润",
        reasons: lowMarginReasons,
      }, priceDetails);
    }

    return Object.assign({ level: "healthy", label: "健康", reasons: ["成交价高于保本价，净利率达到目标"] }, priceDetails);
  }

  return {
    isIncludedOrderStatus,
    deriveTransactionAmounts,
    calculateProfit,
    calculateBreakevenPrice,
    assessPriceRisk,
    normalizeSkuKey,
    findShippingFee,
  };
}));
