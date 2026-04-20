import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

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

// Data captured from the WA_EMBEDDED_SIGNUP message event
interface EmbeddedSignupSessionData {
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
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

  // Store session data from the message event listener
  const sessionDataRef = useRef<EmbeddedSignupSessionData | null>(null);

  // Listen for WA_EMBEDDED_SIGNUP message events from Meta's popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from facebook.com
      if (!event.origin.endsWith('facebook.com')) return;
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('[FB-LOGIN] WA_EMBEDDED_SIGNUP message event:', JSON.stringify(data));
          
          if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
            sessionDataRef.current = {
              phone_number_id: data.data?.phone_number_id,
              waba_id: data.data?.waba_id,
              business_id: data.data?.business_id,
            };
            console.log('[FB-LOGIN] Captured session data:', sessionDataRef.current);
          } else if (data.event === 'CANCEL') {
            console.log('[FB-LOGIN] User cancelled at step:', data.data?.current_step);
          }
        }
      } catch {
        // Non-JSON messages, ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
      const maxAttempts = 50;
      
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
    sessionDataRef.current = null; // Reset session data
    
    try {
      await waitForSdk();

      return new Promise((resolve) => {
        window.FB.login(
          (response: FacebookLoginResponse) => {
            console.log('[FB-LOGIN] Response:', response);

            if (response.status === 'connected' && response.authResponse?.code) {
              // Pass the session data (phone_number_id, waba_id) from message event
              const sessionData = sessionDataRef.current;
              console.log('[FB-LOGIN] Session data at code exchange:', sessionData);

              exchangeCodeForToken(response.authResponse.code, sessionData)
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

  const exchangeCodeForToken = async (
    code: string,
    sessionData: EmbeddedSignupSessionData | null
  ): Promise<EmbeddedSignupResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('meta-exchange-token', {
        body: { 
          code,
          // Pass the IDs captured from the message event
          phone_number_id: sessionData?.phone_number_id,
          waba_id: sessionData?.waba_id,
          business_id: sessionData?.business_id,
        }
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
