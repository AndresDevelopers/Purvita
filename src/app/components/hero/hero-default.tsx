
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { SiteBranding } from "@/modules/site-content/domain/models/site-branding";
import type { Locale } from "@/i18n/config";

export interface HeroProps {
    title: string;
    subtitle: string;
    backgroundImageUrl: string | null;
    backgroundColor?: string | null;
    branding: SiteBranding;
    dictionary: any;
    lang: Locale;
}

export function HeroDefault({
    title,
    subtitle,
    backgroundImageUrl,
    backgroundColor,
    branding,
    dictionary,
    lang,
}: HeroProps) {
    return (
        <section className="relative overflow-hidden rounded-3xl px-6 py-16 text-white shadow-lg" style={{ backgroundColor: backgroundColor || '#10b981' }}>
            {backgroundImageUrl && (
                <div className="absolute inset-0 opacity-20">
                    <Image
                        src={backgroundImageUrl}
                        alt={`${branding.appName} hero`}
                        fill
                        sizes="100vw"
                        className="object-cover"
                        priority
                        quality={90}
                        placeholder="blur"
                        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMwNjQ3MzgiLz48L3N2Zz4="
                    />
                </div>
            )}
            <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
                <span className="rounded-full border border-white/40 px-4 py-1 text-sm font-semibold uppercase tracking-wide">
                    {branding.appName}
                </span>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                    {title}
                </h1>
                <p className="max-w-2xl text-lg text-white/80">
                    {subtitle}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild size="lg" className="rounded-full px-8">
                        <Link href={`/${lang}/subscriptions`}>{dictionary.explorePlans}</Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary" className="rounded-full px-8">
                        <Link href={`/${lang}/auth/register`}>{dictionary.joinNow}</Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
