export type PhoneRegion = "DE" | "BD" | "US" | "Global";

export type PhoneValidationResult = {
  isValid: boolean;
  normalized: string;
  error: string;
};

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const BANGLADESH_MOBILE_PATTERN = /^\+8801[3-9]\d{8}$/;
const GERMANY_MOBILE_PATTERN = /^\+491[5-7]\d{7,9}$/;
const US_MOBILE_PATTERN = /^\+1[2-9]\d{2}[2-9]\d{6}$/;

export const sanitizePhoneInput = (value: string): string => {
  const hasInternationalPrefix = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);

  return hasInternationalPrefix ? `+${digits}` : digits;
};

const invalid = (error: string): PhoneValidationResult => ({
  isValid: false,
  normalized: "",
  error
});

const validateInternationalNumber = (
  phone: string
): PhoneValidationResult => {
  if (!E164_PATTERN.test(phone)) {
    return invalid(
      "Enter a valid international mobile number with country code."
    );
  }

  if (phone.startsWith("+880") && !BANGLADESH_MOBILE_PATTERN.test(phone)) {
    return invalid("Enter a valid Bangladesh mobile number.");
  }

  if (phone.startsWith("+49") && !GERMANY_MOBILE_PATTERN.test(phone)) {
    return invalid("Enter a valid Germany mobile number.");
  }

  if (phone.startsWith("+1") && !US_MOBILE_PATTERN.test(phone)) {
    return invalid("Enter a valid United States mobile number.");
  }

  return { isValid: true, normalized: phone, error: "" };
};

export const validateAndNormalizePhone = (
  value: string,
  region: PhoneRegion
): PhoneValidationResult => {
  const phone = sanitizePhoneInput(value);
  if (!phone) {
    return invalid("A mobile number is required.");
  }

  if (phone.startsWith("+")) {
    return validateInternationalNumber(phone);
  }

  if (region === "BD") {
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return invalid(
        "Enter a valid Bangladesh mobile number, for example 01712345678."
      );
    }
    return {
      isValid: true,
      normalized: `+880${phone.slice(1)}`,
      error: ""
    };
  }

  if (region === "DE") {
    if (!/^01[5-7]\d{7,9}$/.test(phone)) {
      return invalid(
        "Enter a valid Germany mobile number, for example 01711234567."
      );
    }
    return {
      isValid: true,
      normalized: `+49${phone.slice(1)}`,
      error: ""
    };
  }

  if (region === "US") {
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(phone)) {
      return invalid(
        "Enter a valid 10-digit United States mobile number."
      );
    }
    return { isValid: true, normalized: `+1${phone}`, error: "" };
  }

  return invalid(
    "Include the country code, for example +8801712345678."
  );
};
