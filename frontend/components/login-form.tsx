"use client";

import Link from "next/link";
import type { FormEvent } from "react";

type LoginFormProps = {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  error: string;
  alternateLabel: string;
  alternateHref: string;
  alternateText: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none";

export function LoginForm(props: LoginFormProps) {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {props.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
        </div>
        <form
          onSubmit={props.onSubmit}
          className="rounded-lg border border-slate-200 bg-white shadow-sm"
        >
          <div className="grid gap-4 p-5">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
              Email
              <input
                type="email"
                className={input}
                value={props.email}
                onChange={(event) => props.onEmailChange(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
              Password
              <input
                type="password"
                className={input}
                value={props.password}
                onChange={(event) => props.onPasswordChange(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            {props.error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {props.error}
              </p>
            ) : null}
            <button
              type="submit"
              className="rounded-md border border-blue-600 bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Log in
            </button>
            <p className="text-center text-xs text-slate-500">
              {props.alternateLabel}{" "}
              <Link
                href={props.alternateHref}
                className="text-blue-600 hover:underline"
              >
                {props.alternateText}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
