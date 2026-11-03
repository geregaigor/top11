// Очікувана ринкова вартість гравця без рангу (аукціон): залежить тільки від віку і ОБЩ.
// Підібрано по 15 лотам аукціону (03.11.2026), похибка ~2.6%:
//   ln(вартість) = 5.5788 − 0.0669·вік + 0.0118·ОБЩ
// тобто +1 рік = −6.5%, +1 ОБЩ = +1.2%.
import { SKILL_BASE, SKILL_STEP } from './skills';

const A = 5.5788;
const B_AGE = -0.0669;
const B_OVR = 0.0118;

/** ОБЩ лота аукціону: у таких гравців усі 15 навичок без рангу, ОБЩ = середнє */
export const auctionOvr = (skillAvg: number) => Math.floor((skillAvg - SKILL_BASE) / SKILL_STEP);

/** Очікувана вартість у тих самих одиницях, що й ціна гри */
export const expectedValue = (age: number, ovr: number) => Math.exp(A + B_AGE * age + B_OVR * ovr) * 1e6;
