/**
 * Custom read-only route exposing the public reCAPTCHA site key to the
 * frontend. Kept separate from the core smtp-setting router so the SMTP
 * credentials and reCAPTCHA secret are never served by this endpoint.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/recaptcha-config',
      handler: 'smtp-setting.getRecaptchaConfig',
      config: {
        auth: false,
      },
    },
  ],
};
