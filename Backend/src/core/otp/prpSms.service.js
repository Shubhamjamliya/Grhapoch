import axios from 'axios';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const PRPSMS_URL = 'https://api.bulksmsadmin.com/BulkSMSapi/keyApiSendSMS/SendSmsTemplateName';

const maskPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length >= 4 ? `******${digits.slice(-4)}` : 'unknown';
};

/** PRPSMS expects a plain 10 digit number (or 91 + 10 digits). */
const normalizePhoneNumber = (phone) => {
    const digits = String(phone || '').replace(/[^0-9]/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    return digits.slice(-10);
};

export const isPrpSmsConfigured = () => Boolean(String(config.prpSmsApiKey || '').trim());

/**
 * Sends an OTP through the PRPSMS template API. Throws when the provider is not configured
 * or rejects the request, so the caller can fail the OTP request visibly.
 */
export const sendOtpViaPrpSms = async (phone, otp) => {
    if (!isPrpSmsConfigured()) {
        throw new Error('PRPSMS configuration missing: PRPSMS_API_KEY');
    }

    const mobileNo = normalizePhoneNumber(phone);
    const payload = {
        sender: config.prpSmsSenderId || 'VRUSOY',
        templateName: config.prpSmsOtpTemplate || 'Temp 4',
        smsReciever: [{ mobileNo, templateParams: String(otp) }],
    };

    try {
        logger.info(`[SMS] Sending OTP to ${maskPhone(mobileNo)} via PRPSMS...`);
        const response = await axios.post(PRPSMS_URL, payload, {
            headers: { apikey: config.prpSmsApiKey, 'Content-Type': 'application/json' },
            timeout: 20000,
        });

        const status = String(response.data?.status ?? '').toLowerCase();
        if (response.status !== 200 || ['error', 'failed', 'failure', 'false'].includes(status)) {
            logger.error(`[SMS] PRPSMS rejected OTP for ${maskPhone(mobileNo)} (HTTP ${response.status})`);
            throw new Error('SMS provider rejected the OTP request');
        }

        logger.info(`[SMS] OTP accepted by PRPSMS for ${maskPhone(mobileNo)}`);
    } catch (error) {
        const message = error.code === 'ECONNABORTED' ? 'SMS provider request timed out' : error.message;
        logger.error(`[SMS] PRPSMS OTP delivery failed for ${maskPhone(mobileNo)}: ${message}`);
        throw new Error(message);
    }
};
