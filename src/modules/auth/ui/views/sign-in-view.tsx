"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import dynamicImport from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { OctagonAlert, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1, {
    message: "请输入密码",
  }),
});

const FALLBACK_COVER = "/bg.jpg";

const AuthShaderBackground = dynamicImport(
  () => import("@/modules/auth/ui/components/auth-shader-background"),
  { ssr: false },
);

export const SignInView = ({ coverId }: { coverId?: string | null }) => {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [forgotNow, setForgotNow] = useState(Date.now());

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forgot-cooldown-until");
      if (saved && Number(saved) > Date.now()) setForgotCooldown(Number(saved));
    } catch {}
    const t = setInterval(() => setForgotNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [forgotPending, setForgotPending] = useState(false);
  const [cover, setCover] = useState(
    coverId ? `/api/photo/v2/${coverId}?v=display` : FALLBACK_COVER,
  );

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof signInSchema>) => {
    setError(null);
    setPending(true);

    authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
        callbackURL: "/dashboard",
      },
      {
        onSuccess: () => {
          setPending(false);
        },
        onError: ({ error }) => {
          setPending(false);
          setError(error.message);
        },
      }
    );
  };

  const handleForgotPassword = () => {
    setForgotPending(true);
    setError(null);
    setNotice(null);

    authClient.requestPasswordReset(
      {
        email: forgotEmail,
        redirectTo: "/reset-password",
      },
      {
        onSuccess: () => {
          setForgotPending(false);
          setForgotOpen(false);
          const until = Date.now() + 10 * 60 * 1000;
          try { localStorage.setItem("forgot-cooldown-until", String(until)); } catch {}
          setForgotCooldown(until);
          setNotice("重置邮件已发送，请查收邮箱（链接 15 分钟内有效；10 分钟内不可重复发送）");
        },
        onError: ({ error }) => {
          setForgotPending(false);
          setError(error.message ?? "发送失败，请稍后重试");
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-100 via-indigo-50 to-rose-100">
        <AuthShaderBackground coverUrl={cover} playing />
      </div>
      <div className="grid overflow-hidden rounded-[22px] border border-white/20 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_24px_80px_-24px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150 md:grid-cols-3 dark:border-white/10 dark:bg-black/40">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="p-6 md:p-8 flex flex-col justify-center min-h-full"
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">欢迎回来</h1>
                  <p className="text-muted-foreground text-balance">登录你的账号</p>
                </div>

                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="your.email@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="* * * * * * * *"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <AlertDialog open={forgotOpen} onOpenChange={setForgotOpen}>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                        >
                          忘记密码？
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>发送重置邮件</AlertDialogTitle>
                          <AlertDialogDescription>
                            请输入你的注册邮箱，我们将发送一封包含重置链接的邮件，链接将在 15 分钟后失效，请及时查收。
                          </AlertDialogDescription>
                          <input
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="mt-2 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                          />
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={forgotPending}>
                            取消
                          </AlertDialogCancel>
                          <AlertDialogAction
                            disabled={
                              forgotPending ||
                              !forgotEmail.includes("@") ||
                              forgotCooldown > forgotNow
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              handleForgotPassword();
                            }}
                          >
                            {forgotPending && <Spinner />}
                            {forgotCooldown > forgotNow
                              ? `已发送，${Math.ceil((forgotCooldown - forgotNow) / 1000)}s 后可重发`
                              : "发送重置邮件"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {!!notice && (
                  <Alert className="bg-emerald-500/15 border-none">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600!" />
                    <AlertTitle>{notice}</AlertTitle>
                  </Alert>
                )}
                {!!error && (
                  <Alert className="bg-destructive/10 border-none">
                    <OctagonAlert className="h-4 w-4 text-destructive!" />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending && <Spinner />}
                  登录
                </Button>
              </div>
            </form>
          </Form>
          <div className="col-span-2 relative hidden md:flex flex-col gap-y-4 items-center justify-center">
            <Image
              src={cover}
              alt=""
              width={1920}
              height={1080}
              unoptimized
              className="size-full object-cover"
              onError={() =>
                setCover((current) =>
                  current === FALLBACK_COVER ? current : FALLBACK_COVER,
                )
              }
            />
          </div>
      </div>
    </div>
  );
};
