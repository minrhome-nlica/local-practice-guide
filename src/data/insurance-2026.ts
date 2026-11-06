/** Official 2026 (ROC 115) monthly insured amount levels.
 * NHI public table: https://www.nhi.gov.tw/ch/cp-19421-f9533-2569-1.html
 * Labor insurance: https://www.bli.gov.tw/0007801.html
 * The first 38 NHI levels coincide with the standard pension contribution levels,
 * though exceptional low-income/part-time tiers must use the official tables.
 */
export const laborGrades2026 = [29500,30300,31800,33300,34800,36300,38200,40100,42000,43900,45800] as const;
export const healthGrades2026 = [29500,30300,31800,33300,34800,36300,38200,40100,42000,43900,45800,48200,50600,53000,55400,57800,60800,63800,66800,69800,72800,76500,80200,83900,87600,92100,96600,101100,105600,110100,115500,120900,126300,131700,137100,142500,147900,150000,156400,162800,169200,175600,182000,189500,197000,204500,212000,219500,228200,236900,245600,254300,263000,273000,283000,293000,303000,313000] as const;
export const pensionGrades2026 = healthGrades2026.slice(0, 38);
export const accidentGrades2026 = healthGrades2026.slice(0, 21);
export const monthlyMinimumWage2026 = 29500;
export const laborOrdinaryRate2026 = 0.115;
export const employmentRate2026 = 0.01;
export const healthRate2026 = 0.0517;
export const averageDependents2026 = 0.56;
