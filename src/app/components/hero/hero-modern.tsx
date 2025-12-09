
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroProps } from "./hero-default";

export function HeroModern({
    title,
    subtitle,
    backgroundImageUrl,
    backgroundColor,
    branding,
    dictionary,
    lang,
}: HeroProps) {
    return (
        <section className="relative min-h-[600px] overflow-hidden rounded-3xl text-white shadow-2xl" style={{ backgroundColor: backgroundColor || '#0f172a' }}>
            {/* Background Image with Gradient Overlay */}
            {backgroundImageUrl && (
                <div className="absolute inset-0">
                    <Image
                        src={backgroundImageUrl}
                        alt={`${branding.appName} hero`}
                        fill
                        sizes="100vw"
                        className="object-cover"
                        priority
                        quality={90}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent" />
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 flex h-full min-h-[600px] items-center px-8 py-16 md:px-16">
                <div className="max-w-2xl space-y-8">
                    <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 backdrop-blur-sm">
                        <span className="mr-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        {branding.appName}
                    </div>

                    <h1 className="text-5xl font-extrabold tracking-tight leading-tight md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                        {title}
                    </h1>

                    <p className="text-xl text-slate-300 leading-relaxed max-w-lg">
                        {subtitle}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button asChild size="lg" className="h-14 rounded-full px-8 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20">
                            <Link href={`/${lang}/auth/register`}>{dictionary.joinNow}</Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="h-14 rounded-full px-8 text-lg border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white">
                            <Link href={`/${lang}/subscriptions`}>{dictionary.explorePlans}</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
