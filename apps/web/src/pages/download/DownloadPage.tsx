import { Download, Smartphone, Apple, ShieldCheck, FolderDown, PackageOpen, LogIn, UserCheck } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";

const API_BASE = `${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? ""}/api/v1`;
const APK_URL = `${API_BASE}/downloads/dorada-beta.apk`;
const IPA_URL = `${API_BASE}/downloads/dorada-beta.ipa`;

function Step({ number, icon: Icon, title, isLast, children }: { number: number; icon: typeof Download; title: string; isLast?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          {number}
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        <div className="mt-1 text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function DownloadPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <img
              src="/fruta-dorada-illustrated3.png"
              alt="Dorada"
              className="h-16 rounded-full object-contain"
              style={{ width: "3rem" }}
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Dorada</h1>
          <p className="text-muted-foreground">
            Download the Dorada app to get started with your appointments.
          </p>
        </div>

        {/* ── Android ── */}

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-semibold">Android</h2>
            </div>

            <a href={APK_URL} download>
              <Button className="w-full gap-2" size="lg">
                <Download className="h-4 w-4" />
                Download Dorada App
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-1">How to install on Android</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Since this app is not from the Play Store, your phone will ask for permission to install it. This is normal and safe — follow the steps below.
            </p>

            <Step number={1} icon={FolderDown} title="Download the app">
              Tap the <strong>Download Dorada App</strong> button above. Your phone
              will download a file — you may see a progress bar at the top of your
              screen or a notification when it finishes.
            </Step>

            <Step number={2} icon={ShieldCheck} title="Allow installation">
              <p>
                When the download finishes, tap the notification or tap{" "}
                <strong>Open</strong>. Your phone will show a warning that says
                something like{" "}
                <em>&ldquo;For your security, your phone is not allowed to install
                unknown apps from this source.&rdquo;</em>
              </p>
              <p className="mt-2">
                Tap <strong>Settings</strong> when prompted, then turn on{" "}
                <strong>&ldquo;Allow from this source&rdquo;</strong> and go back.
              </p>
              <p className="mt-2 text-xs italic">
                If you don&apos;t see this prompt, go to your phone&apos;s{" "}
                <strong>Settings &rarr; Apps &rarr; Special access &rarr; Install
                unknown apps</strong>, find your browser (Chrome, Samsung Internet, etc.),
                and turn it on.
              </p>
            </Step>

            <Step number={3} icon={PackageOpen} title="Install the app">
              After allowing the permission, you&apos;ll see an &ldquo;Install&rdquo;
              button. Tap <strong>Install</strong> and wait a few seconds for it to
              finish. Then tap <strong>Open</strong>.
            </Step>

            <Step number={4} icon={LogIn} title="Log in" isLast>
              Open the Dorada app and log in using the phone number and credentials
              provided to you by your administrator. You&apos;ll receive a verification
              code via text message.
            </Step>
          </CardContent>
        </Card>

        {/* ── iOS ── */}

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Apple className="h-6 w-6 text-gray-800 dark:text-gray-200" />
              <h2 className="text-lg font-semibold">iOS (iPhone)</h2>
            </div>

            <a href={IPA_URL} download>
              <Button className="w-full gap-2" size="lg">
                <Download className="h-4 w-4" />
                Download Dorada App
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-1">How to install on iPhone</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Since this app is not from the App Store, you&apos;ll need to trust the
              developer profile before it can open. This is normal and safe — follow
              the steps below.
            </p>

            <Step number={1} icon={FolderDown} title="Download the app">
              Tap the <strong>Download Dorada App</strong> button above. Your iPhone
              will download the file. You may see a message saying{" "}
              <em>&ldquo;dorada.app wants to install &lsquo;Dorada&rsquo;&rdquo;</em> —
              tap <strong>Install</strong>.
            </Step>

            <Step number={2} icon={UserCheck} title="Trust the developer">
              <p>
                After installing, if the app won&apos;t open, you need to trust
                the developer profile. Go to{" "}
                <strong>Settings &rarr; General &rarr; VPN &amp; Device Management</strong>.
              </p>
              <p className="mt-2">
                Find the developer profile (it may show an email or company name),
                tap it, then tap <strong>&ldquo;Trust&rdquo;</strong> and confirm.
              </p>
            </Step>

            <Step number={3} icon={PackageOpen} title="Open the app">
              Go back to your home screen and tap the <strong>Dorada</strong> app
              icon. It should now open normally.
            </Step>

            <Step number={4} icon={LogIn} title="Log in" isLast>
              Log in using the phone number and credentials provided to you by your
              administrator. You&apos;ll receive a verification code via text message.
            </Step>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Having trouble? Contact your administrator for help.
        </p>
      </div>
    </div>
  );
}
