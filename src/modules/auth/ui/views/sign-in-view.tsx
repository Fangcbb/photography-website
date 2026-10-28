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
import { OctagonAlert } from "lucide-react";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1, {
    message: "请输入密码",
  }),
});

const FALLBACK_COVER = "/bg.jpg";

const AuraShaderBackground = dynamicImport(
  () => import("@/components/AuraMusic/components/AuraShaderBackground"),
  { ssr: false },
);

export const SignInView = ({ coverId }: { coverId?: string | null }) => {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-100 via-indigo-50 to-rose-100">
        <AuraShaderBackground coverUrl={cover} playing />
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
                </div>
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
