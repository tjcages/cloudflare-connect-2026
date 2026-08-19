import ConnectCloud from "@/assets/connect/connect-cloud.svg?react";
import cn from "classnames";
import { useState, type FormEvent } from "react";

const TERMS_HREF = "https://www.cloudflare.com/website-terms/";
const PRIVACY_HREF = "https://www.cloudflare.com/privacypolicy/";
const COOKIE_HREF = "https://www.cloudflare.com/cookie-policy/";
const SIGN_UP_HREF = "https://dash.cloudflare.com/sign-up";
const FORGOT_HREF = "https://dash.cloudflare.com/forgot-password";

const fieldClass =
  "h-40 w-full rounded-[4px] border border-[#d9d9d9] bg-white px-12 text-[14px] leading-20 text-[#1d1d1d] outline-none transition-colors placeholder:text-[#7e7e7e] focus:border-[#f6821f] focus:shadow-[0_0_0_1px_#f6821f]";

const ghostButtonClass =
  "inline-flex h-40 items-center justify-center gap-8 rounded-[4px] border border-[#d9d9d9] bg-white px-12 text-[14px] leading-20 font-medium text-[#1d1d1d] transition-colors hover:bg-[#f5f5f5] focus-visible:border-[#f6821f] focus-visible:shadow-[0_0_0_1px_#f6821f] focus-visible:outline-none";

const linkClass =
  "text-[#0055dc] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline";

export default function DashboardLoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div className="dash-login bg-white flex h-full min-h-svh flex-col px-32 py-24 font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#1d1d1d] max-lg:min-h-0 max-lg:px-24">
      <a
        aria-label="Cloudflare"
        className="inline-flex w-max items-center"
        href="https://www.cloudflare.com/"
        rel="noreferrer"
        target="_blank"
      >
        <ConnectCloud aria-hidden className="h-32 w-auto" />
      </a>

      <div className="flex flex-1 items-center py-40">
        <form
          className="mx-auto w-full max-w-360"
          noValidate
          onSubmit={onSubmit}
        >
          <h1 className="text-[24px] leading-32 font-semibold tracking-[-0.02em] text-[#1d1d1d]">
            Sign in to Cloudflare
          </h1>

          <div className="mt-24 grid grid-cols-3 gap-8">
            <SocialButton label="Google" provider="google" />
            <SocialButton label="Apple" provider="apple" />
            <SocialButton label="GitHub" provider="github" />
          </div>

          <button className={cn(ghostButtonClass, "mt-8 w-full")} type="button">
            Continue with SSO
          </button>

          <div className="mt-20 flex items-center gap-12">
            <span className="h-px flex-1 bg-[#e6e6e6]" />
            <span className="text-[12px] leading-16 text-[#7e7e7e]">or</span>
            <span className="h-px flex-1 bg-[#e6e6e6]" />
          </div>

          <label className="mt-20 block text-[14px] leading-20 font-medium text-[#313131]">
            Email
            <input
              autoComplete="username"
              className={cn(fieldClass, "mt-6")}
              name="email"
              spellCheck={false}
              type="email"
            />
          </label>

          <label className="mt-16 block text-[14px] leading-20 font-medium text-[#313131]">
            Password
            <span className="relative mt-6 block">
              <input
                autoComplete="current-password"
                className={cn(fieldClass, "pr-40")}
                name="password"
                type={showPassword ? "text" : "password"}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-0 right-0 flex h-40 w-40 items-center justify-center text-[#7e7e7e] hover:text-[#1d1d1d]"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>

          <label className="mt-16 flex cursor-pointer items-start gap-10 text-[14px] leading-20 text-[#313131]">
            <input
              className="mt-2 size-16 shrink-0 accent-[#f6821f]"
              name="remember"
              type="checkbox"
            />
            Save email and login method on this device
          </label>

          <button
            className="text-white mt-24 inline-flex h-40 w-full items-center justify-center rounded-[4px] bg-[#f6821f] text-[14px] leading-20 font-semibold transition-colors hover:bg-[#e67a1c] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#f6821f] focus-visible:outline-none"
            type="submit"
          >
            Sign in
          </button>

          <p className="mt-20 text-[14px] leading-20 text-[#313131]">
            Don&apos;t have an account?{" "}
            <a className={linkClass} href={SIGN_UP_HREF}>
              Sign up
            </a>
          </p>
          <p className="mt-8 text-[14px] leading-20">
            <a className={linkClass} href={FORGOT_HREF}>
              Forgot your email or password?
            </a>
          </p>
        </form>
      </div>

      <p className="max-w-400 text-[12px] leading-18 text-[#7e7e7e]">
        By continuing, I agree to Cloudflare&apos;s{" "}
        <a className={linkClass} href={TERMS_HREF}>
          terms
        </a>
        ,{" "}
        <a className={linkClass} href={PRIVACY_HREF}>
          privacy policy
        </a>
        , and{" "}
        <a className={linkClass} href={COOKIE_HREF}>
          cookie policy
        </a>
        .
      </p>
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
    <button className={ghostButtonClass} type="button">
      {icon}
      <span className="max-[420px]:hidden">{label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden className="size-16" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09A6.97 6.97 0 0 1 5.48 12c0-.72.13-1.43.36-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      aria-hidden
      className="size-16"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M16.37 12.62c.03-2.1 1.72-3.11 1.8-3.16-1-.1-2.16.58-2.72.58-.56 0-1.43-.57-2.35-.55-1.21.02-2.32.7-2.94 1.78-1.26 2.18-.32 5.4.9 7.17.6.86 1.3 1.83 2.23 1.8.89-.04 1.23-.58 2.3-.58s1.37.58 2.32.56c.96-.02 1.56-.87 2.14-1.74.68-1 .96-1.97.97-2.02-.02 0-1.86-.71-1.89-2.84ZM14.7 7.4c.49-.6.82-1.42.73-2.25-.7.03-1.56.47-2.06 1.06-.45.52-.85 1.37-.74 2.17.79.06 1.59-.4 2.07-.98Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden
      className="size-16"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85.01 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.21 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.58 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden className="size-16" fill="none" viewBox="0 0 24 24">
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden className="size-16" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 4 16 16M9.9 9.9A2.6 2.6 0 0 0 12 14.6M14.1 14.1A2.6 2.6 0 0 0 12 9.4M6.2 6.5C3.9 8.2 2.5 12 2.5 12s3.5 7 9.5 7c1.6 0 3-.3 4.2-.8M17.7 16.3C20 14.6 21.5 12 21.5 12s-3.5-7-9.5-7c-.8 0-1.5.1-2.2.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
