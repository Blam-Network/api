export type { Endian } from "../field-type";
export { CFieldType, isCFieldType } from "../field-type";

export * from "./number";
export * from "./bigint";
export * from "./numeric";

export { CPadding, createPadding, pad, isCPadding } from "./padding";
export { CBool, bool } from "./bool";
export { CString } from "./string";
export { CWString } from "./wstring";
export { time64_t, Time64 } from "./time";
export { CMagicNumber } from "./magic-number";
export { CMagicString } from "./magic-string";
export { CBitfield } from "./bitfield";
export { CEnum } from "./enum";
export { CUnion } from "./union";
export {
    CDiscriminatedUnion,
    discriminatedUnion,
    arm,
    when,
    isCDiscriminatedUnion,
    type UnionArmInput,
    type UnionOfArms,
    type UnionArmSchema,
} from "./discriminated-union";
