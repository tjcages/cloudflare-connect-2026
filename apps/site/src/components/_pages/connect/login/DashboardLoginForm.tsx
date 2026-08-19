import cn from "classnames";
import { useState } from "react";

const TERMS_HREF = "https://www.cloudflare.com/subscriptionagreement/";
const PRIVACY_HREF = "https://www.cloudflare.com/privacypolicy/";
const COOKIE_HREF = "https://www.cloudflare.com/cookie-policy/";
const SIGN_UP_HREF = "https://dash.cloudflare.com/sign-up";
const FORGOT_EMAIL_HREF = "https://dash.cloudflare.com/forgot-email";
const FORGOT_PASSWORD_HREF = "https://dash.cloudflare.com/forgot-password";

const ringButtonClass =
  "inline-flex h-40 shrink-0 items-center justify-center gap-8 rounded-[8px] bg-white px-16 text-[16px] leading-24 font-medium text-[#1d1d1d] shadow-[0_1px_2px_rgb(0_0_0_/_0.05)] ring-1 ring-[#d6d6d6] hover:bg-[#f4f4f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6821f]/50";

const fieldClass =
  "h-40 w-full rounded-[8px] bg-white px-16 text-[16px] leading-24 text-[#1d1d1d] outline-none ring-1 ring-[#d6d6d6] placeholder:text-[#8a8a8a] focus:ring-[1.5px] focus:ring-[#0051c3]/50";

const linkClass =
  "font-medium text-[#0051c3] underline decoration-[#0051c3] underline-offset-2 hover:text-[#1d1d1d]";

const mutedLinkClass =
  "text-[#6e6e6e] underline decoration-[#6e6e6e] underline-offset-2 hover:text-[#1d1d1d]";

export default function DashboardLoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const onSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <div className="flex min-h-screen w-full max-w-[28rem] flex-col items-stretch pt-64 min-[1024px]:pt-96">
      <div className="w-full px-16 pt-32 min-[640px]:px-48 min-[640px]:py-24">
        <div className="mb-24">
          <h1
            className="text-center text-[24px] leading-32 font-semibold text-balance text-[#1d1d1d]"
            data-testid="login-heading"
          >
            Sign in to Cloudflare
          </h1>
        </div>

        <div className="flex w-full flex-col gap-8">
          <div className="flex w-full flex-row gap-8">
            <SocialButton label="Google" provider="google" />
            <SocialButton label="Apple" provider="apple" />
            <SocialButton label="GitHub" provider="github" />
          </div>
          <button className={cn(ringButtonClass, "w-full")} type="button">
            <LockIcon />
            Continue with SSO
          </button>
        </div>

        <div className="my-20 flex items-center gap-16">
          <div className="h-px flex-1 bg-[#e8e8e8]" />
          <span className="text-[12px] leading-16 font-medium tracking-wider text-[#6e6e6e] uppercase">
            or
          </span>
          <div className="h-px flex-1 bg-[#e8e8e8]" />
        </div>

        <form
          className="flex flex-col gap-16"
          data-testid="login-form"
          name="login-form"
          noValidate
          onSubmit={onSubmit}
        >
          <div className="grid gap-8">
            <label
              className="m-0 text-[16px] leading-24 font-medium text-[#1d1d1d]"
              htmlFor="email"
            >
              Email
            </label>
            <input
              autoCapitalize="off"
              autoComplete="email"
              className={fieldClass}
              data-testid="login-input-email"
              id="email"
              name="email"
              spellCheck={false}
              type="email"
            />
          </div>

          <div className="grid gap-8">
            <label
              className="m-0 text-[16px] leading-24 font-medium text-[#1d1d1d]"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative flex h-40 items-center overflow-hidden rounded-[8px] ring-1 ring-[#d6d6d6] focus-within:ring-[1.5px] focus-within:ring-[#0051c3]/50">
              <input
                autoCapitalize="off"
                autoComplete="current-password"
                className="h-full min-w-0 grow rounded-none border-0 bg-transparent px-16 text-[16px] leading-24 text-[#1d1d1d] outline-none"
                data-testid="login-input-password"
                id="password"
                name="password"
                spellCheck={false}
                type={showPassword ? "text" : "password"}
              />
              <button
                aria-label={showPassword ? "Hide" : "Show"}
                className="mr-6 inline-flex h-36 w-max shrink-0 items-center justify-center rounded-[8px] px-12 text-[#1d1d1d] hover:bg-[#f4f4f4]"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-start gap-8 text-[16px] leading-24 text-[#1d1d1d]">
            <span
              aria-checked={remember}
              className={cn(
                "relative mt-2 flex size-16 shrink-0 items-center justify-center rounded-[2px] ring-1",
                remember
                  ? "bg-[#1d1d1d] text-white ring-[#1d1d1d]"
                  : "bg-white text-transparent ring-[#d6d6d6]"
              )}
              role="checkbox"
            >
              <CheckIcon />
            </span>
            <input
              checked={remember}
              className="sr-only"
              name="remember"
              onChange={(event) => setRemember(event.target.checked)}
              type="checkbox"
            />
            Save email and login method on this device
          </label>

          <button
            className="relative mt-0 flex h-40 w-full items-center justify-center overflow-hidden rounded-[8px] text-[16px] leading-24 font-medium text-white"
            data-testid="login-submit-button"
            name="login-submit-button"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in srgb, #f6821f 85%, white), #f6821f)",
              boxShadow:
                "0 0 0 1px color-mix(in srgb, #f6821f 90%, black), 0 1px 2px rgb(0 0 0 / 0.05)",
            }}
            type="submit"
          >
            Sign in
          </button>
        </form>

        <div className="mt-16 flex flex-col items-center gap-6">
          <p className="inline-flex items-center gap-4 text-[16px] leading-24 text-[#6e6e6e]">
            Don&apos;t have an account?
            <a
              className="font-medium text-[#0051c3] no-underline hover:text-[#1d1d1d]"
              href={SIGN_UP_HREF}
            >
              Sign up
            </a>
          </p>
          <p className="text-[16px] leading-24 text-[#6e6e6e]">
            Forgot your{" "}
            <a className={linkClass} href={FORGOT_EMAIL_HREF}>
              email
            </a>{" "}
            or{" "}
            <a className={linkClass} href={FORGOT_PASSWORD_HREF}>
              password
            </a>
            ?
          </p>
        </div>
      </div>

      <div className="mx-auto mt-16 w-[90%] px-32 text-center min-[640px]:px-0">
        <p className="text-center text-[13px] leading-20 text-balance text-[#6e6e6e]">
          By continuing, I agree to Cloudflare&apos;s{" "}
          <a className={mutedLinkClass} href={TERMS_HREF} target="_blank">
            terms
          </a>
          ,{" "}
          <a className={mutedLinkClass} href={PRIVACY_HREF} target="_blank">
            privacy policy
          </a>
          , and{" "}
          <a className={mutedLinkClass} href={COOKIE_HREF} target="_blank">
            cookie policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function SocialButton({
  label,
  provider,
}: {
  label: string;
  provider: "google" | "apple" | "github";
}) {
  const icon = (() => {
    switch (provider) {
      case "google":
        return <GoogleIcon />;
      case "apple":
        return <AppleIcon />;
      case "github":
        return <GitHubIcon />;
      default: {
        const _exhaustive: never = provider;
        throw new Error(`Unhandled social provider: ${_exhaustive}`);
      }
    }
  })();

  return (
    <button
      aria-label={`Continue with ${label}`}
      className={cn(ringButtonClass, "w-full flex-1")}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden
      focusable="false"
      height="18"
      style={{ display: "block" }}
      viewBox="0 0 48 48"
      width="15"
    >
      <path
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        fill="#EA4335"
      />
      <path
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        fill="#4285F4"
      />
      <path
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        fill="#FBBC05"
      />
      <path
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        fill="#34A853"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      focusable="false"
      height="18"
      viewBox="0 0 15 18"
      width="15"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.31054 4.48641C8.0927 4.48641 9.07315 3.95762 9.65701 3.25258C10.1858 2.61363 10.5714 1.72131 10.5714 0.82899C10.5714 0.707811 10.5604 0.586631 10.5383 0.487484C9.66803 0.520533 8.62148 1.07135 7.99355 1.80944C7.49781 2.37128 7.04614 3.25258 7.04614 4.15592C7.04614 4.28811 7.06818 4.42031 7.07919 4.46438C7.13427 4.47539 7.22241 4.48641 7.31054 4.48641ZM4.55646 17.8162C5.62504 17.8162 6.09874 17.1001 7.43172 17.1001C8.78672 17.1001 9.08416 17.7941 10.2739 17.7941C11.4417 17.7941 12.2238 16.7145 12.9619 15.657C13.7881 14.4452 14.1296 13.2554 14.1517 13.2003C14.0746 13.1783 11.8382 12.2639 11.8382 9.69713C11.8382 7.47183 13.6009 6.46935 13.7 6.39223C12.5323 4.71775 10.7586 4.67369 10.2739 4.67369C8.96298 4.67369 7.8944 5.46686 7.22241 5.46686C6.49533 5.46686 5.53691 4.71775 4.40223 4.71775C2.24303 4.71775 0.0507812 6.5024 0.0507812 9.87339C0.0507812 11.9665 0.865989 14.1808 1.86847 15.6129C2.72775 16.8247 3.47686 17.8162 4.55646 17.8162Z"
        fill="#000000"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="18"
      viewBox="0 0 32 32"
      width="15"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.9971 0C7.16448 0 0.000411782 7.2028 0.000411782 16.0894C-0.0237699 19.4347 1.01764 22.7039 2.97925 25.4405C4.94085 28.1772 7.72472 30.2447 10.9422 31.3543C11.742 31.5016 12.0336 31.0049 12.0336 30.5788C12.0336 30.1968 12.0201 29.1854 12.0121 27.8426C7.56255 28.8148 6.62367 25.6857 6.62367 25.6857C5.89643 23.8275 4.84742 23.332 4.84742 23.332C3.39479 22.3338 4.95755 22.3537 4.95755 22.3537C5.46809 22.4277 5.95449 22.6158 6.37926 22.9033C6.80402 23.1908 7.15581 23.5702 7.40751 24.0121C8.83429 26.4702 11.1514 25.7623 12.0632 25.3489C12.1338 24.5372 12.4934 23.7757 13.079 23.198C9.52646 22.7925 5.78999 21.4123 5.78999 15.2469C5.76383 13.6557 6.35196 12.1137 7.43643 10.93C6.94808 9.54089 7.004 8.02324 7.59332 6.67232C7.59332 6.67232 8.93642 6.23961 11.9918 8.32169C14.611 7.59909 17.3826 7.59909 20.0018 8.32169C23.0554 6.23961 24.396 6.67232 24.396 6.67232C24.9865 8.02285 25.0434 9.54066 24.5554 10.93C25.64 12.1134 26.2276 13.6558 26.2 15.2469C26.2 21.4273 22.4598 22.7907 18.8962 23.1859C19.2798 23.5803 19.5746 24.0493 19.7617 24.5626C19.9488 25.0759 20.0239 25.6219 19.9822 26.1654C19.9822 28.3163 19.9625 30.0514 19.9625 30.5788C19.9625 31.0091 20.2504 31.5094 21.0626 31.3525C24.2777 30.2411 27.0591 28.1731 29.0189 25.437C30.9787 22.7009 32.0191 19.4331 31.9951 16.0894C31.9951 7.2028 24.8322 0 15.9971 0Z"
        fill="#0A0A0A"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="18"
      viewBox="0 0 256 256"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="20"
      viewBox="0 0 256 256"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="20"
      viewBox="0 0 256 256"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85A32,32,0,0,1,101.25,110.46ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128c4.69-8.79,19.58-32.67,47.35-49.32l18,19.75a48,48,0,0,0,63.66,70.07l16.73,18.4A112,112,0,0,1,128,192ZM247.31,124.76c-.36.82-8.92,19.85-28,38.83a8,8,0,1,1-11.46-11.14,132.36,132.36,0,0,0,22.2-30.2A133.46,133.46,0,0,0,207.93,97.25C185.67,75.19,158.78,64,128,64a112.62,112.62,0,0,0-19.4,1.68,8,8,0,1,1-2.74-15.76A128.73,128.73,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,124.76Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="12"
      viewBox="0 0 256 256"
      width="12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z" />
    </svg>
  );
}
