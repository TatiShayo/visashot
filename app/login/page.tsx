import Link from "next/link";

export const metadata = {
  title: "Login — VisaShot",
  description: "Sign in to access your orders and administrative controls.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-neutral-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-extrabold tracking-tight">Sign in to VisaShot</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Enter your order access token or administrative credentials.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-neutral-800">
          <form className="space-y-6" action="/api/auth/login" method="POST">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-neutral-300">
                Order ID or Access Token
              </label>
              <div className="mt-1">
                <input
                  id="token"
                  name="token"
                  type="text"
                  required
                  placeholder="ord_..."
                  className="appearance-none block w-full px-3 py-2 border border-neutral-700 rounded-lg bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-neutral-950 bg-emerald-400 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Access Order
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-neutral-500">
            Need a new visa photo?{" "}
            <Link href="/create" className="text-emerald-400 hover:underline">
              Create photo now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
