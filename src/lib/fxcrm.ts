import axios from 'axios';

export interface FxConfig {
    appId: string;
    appSecret: string;
    permanentCode: string; // The code you get when you register the app in FxCRM
}

export interface FxAuthToken {
    corpAccessToken: string;
    corpId: string;
    expiresIn: number;
}

const FX_API_BASE = 'https://open.fxiaoke.com'; // Standard base URL, might differ for private deployments

export class FxClient {
    private config: FxConfig;
    private token: FxAuthToken | null = null;

    constructor(config: FxConfig) {
        this.config = config;
    }

    /**
     * Get the Corp Access Token.
     * Documentation: https://open.fxiaoke.com/wiki.html#corpAccessToken
     */
    async getAccessToken(): Promise<string> {
        if (this.token && Date.now() < this.token.expiresIn) {
            return this.token.corpAccessToken;
        }

        try {
            const response = await axios.post(`${FX_API_BASE}/cgi/corpAccessToken/get/V2`, {
                appId: this.config.appId,
                appSecret: this.config.appSecret,
                permanentCode: this.config.permanentCode,
            });

            const { errorCode, errorMessage, corpAccessToken, corpId, expiresIn } = response.data;

            if (errorCode !== 0) {
                throw new Error(`FxCRM Auth Error: ${errorMessage} (${errorCode})`);
            }

            this.token = {
                corpAccessToken,
                corpId,
                expiresIn: Date.now() + (expiresIn * 1000) - 60000, // Buffer 1 minute
            };

            return corpAccessToken;
        } catch (error) {
            console.error("Failed to get access token", error);
            throw error;
        }
    }

    /**
     * Generic POST request wrapper
     */
    async post(endpoint: string, data: any) {
        const token = await this.getAccessToken();
        const response = await axios.post(`${FX_API_BASE}${endpoint}`, {
            corpAccessToken: token,
            corpId: this.token?.corpId,
            ...data
        });
        return response.data;
    }
}
