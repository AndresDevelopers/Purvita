/**
 * Search Console Verification Component
 * 
 * Add verification meta tags for Google Search Console, Bing Webmaster Tools,
 * and other search engines.
 * 
 * To use:
 * 1. Get verification codes from each search console
 * 2. Add them to environment variables
 * 3. This component will automatically include them
 */
export function SearchConsoleVerification() {
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
  const yandexVerification = process.env.NEXT_PUBLIC_YANDEX_VERIFICATION;
  const pinterestVerification = process.env.NEXT_PUBLIC_PINTEREST_VERIFICATION;

  return (
    <>
      {/* Google Search Console Verification */}
      {googleVerification && (
        <meta name="google-site-verification" content={googleVerification} />
      )}
      
      {/* Bing Webmaster Tools Verification */}
      {bingVerification && (
        <meta name="msvalidate.01" content={bingVerification} />
      )}
      
      {/* Yandex Webmaster Verification */}
      {yandexVerification && (
        <meta name="yandex-verification" content={yandexVerification} />
      )}
      
      {/* Pinterest Domain Verification */}
      {pinterestVerification && (
        <meta name="p:domain_verify" content={pinterestVerification} />
      )}
      
      {/* Facebook Domain Verification - if using Facebook Pixel */}
      {process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION && (
        <meta
          name="facebook-domain-verification"
          content={process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION}
        />
      )}
    </>
  );
}

