import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras?: {
            setup?: Record<string, unknown>;
            featureType?: string;
            sessionInfoVersion?: number;
          };
        }
      ) => void;
      getLoginStatus: (callback: (response: FacebookLoginResponse) => void) => void;
    };
  }
}

interface FacebookLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: {
    accessToken: string;
    userID: string;
    expiresIn: number;
    signedRequest: string;
    code?: string;
  };
}

interface EmbeddedSignupResult {
  success: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  businessName?: string;
  error?: string;
}

export const useFacebookLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<{
    phoneNumberId: string;
    wabaId: string;
    displayPhoneNumber: string;
    businessName?: string;
  } | null>(null);

  const isSdkLoaded = useCallback(() => {
    return typeof window !== 'undefined' && window.FB !== undefined;
  }, []);

  const waitForSdk = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (isSdkLoaded()) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkSdk = setInterval(() => {
        attempts++;
        if (isSdkLoaded()) {
          clearInterval(checkSdk);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkSdk);
          reject(new Error('Facebook SDK não carregou. Verifique sua conexão.'));
        }
      }, 100);
    });
  }, [isSdkLoaded]);

  const launchEmbeddedSignup = useCallback(async (configId: string): Promise<EmbeddedSignupResult> => {
    setIsLoading(true);
    
    try {
      await waitForSdk();

      return new Promise((resolve) => {
        window.FB.login(
          (response: FacebookLoginResponse) => {
            console.log('[FB-LOGIN] Response:', response);

            if (response.status === 'connected' && response.authResponse?.code) {
              // Exchange the code for tokens via edge function
              exchangeCodeForToken(response.authResponse.code)
                .then((result) => {
                  if (result.success) {
                    setIsConnected(true);
                    setConnectedAccount({
                      phoneNumberId: result.phoneNumberId!,
                      wabaId: result.wabaId!,
                      displayPhoneNumber: result.displayPhoneNumber!,
                      businessName: result.businessName,
                    });
                  }
                  resolve(result);
                })
                .catch((error) => {
                  resolve({ success: false, error: error.message });
                });
            } else {
              console.log('[FB-LOGIN] Login cancelled or failed:', response);
              resolve({ 
                success: false, 
                error: 'Login cancelado ou falhou. Status: ' + response.status 
              });
            }
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: 'only_waba_sharing',
              sessionInfoVersion: 3,
            },
          }
        );
      });
    } catch (error: any) {
      console.error('[FB-LOGIN] Error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [waitForSdk]);

  const exchangeCodeForToken = async (code: string): Promise<EmbeddedSignupResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('meta-exchange-token', {
        body: { code }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao trocar token');
      }

      toast.success('WhatsApp Business conectado com sucesso!');
      
      return {
        success: true,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        displayPhoneNumber: data.displayPhoneNumber,
        businessName: data.businessName,
      };
    } catch (error: any) {
      console.error('[FB-LOGIN] Token exchange error:', error);
      toast.error('Erro ao conectar: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setConnectedAccount(null);
  }, []);

  return {
    isLoading,
    isConnected,
    connectedAccount,
    isSdkLoaded,
    launchEmbeddedSignup,
    disconnect,
  };
};
