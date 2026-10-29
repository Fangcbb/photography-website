import "dotenv/config";

const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;
const name = process.env.SEED_USER_NAME ?? "Admin";

function isStrongPassword(pw: string): boolean {
  return pw.length >= 12;
}

async function main() {
  if (!email) {
    throw new Error("SEED_USER_EMAIL is required");
  }
  if (!password || !isStrongPassword(password)) {
    throw new Error("SEED_USER_PASSWORD is required and must be at least 12 characters");
  }
  // 注册接口默认被禁用（见 src/modules/auth/lib/auth.ts），初始化管理员前需
  // 在服务端环境临时设置 ALLOW_SIGNUP=true，初始化完成后立即移除该变量。
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const url = `${base.replace(/\/$/, "")}/api/auth/sign-up/email`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": base
    },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sign up failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log("User created successfully:", data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
