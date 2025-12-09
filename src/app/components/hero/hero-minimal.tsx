
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroProps } from "./hero-default";
import { ArrowRight } from "lucide-react";

export function HeroMinimal({
    title,
    subtitle,
    backgroundImageUrl,
    backgroundColor,
    branding,
    dictionary,
    lang,
}: HeroProps) {
    return (
        <section className="grid gap-8 rounded-3xl bg-background px-6 py-16 md:grid-cols-2 md:items-center md:px-12 lg:gap-16 lg:py-24">
            <div className="space-y-8">
                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
                        {title}
                    </h1>
                    <p className="max-w-[600px] text-lg text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                        {subtitle}
                    </p>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                    <Button asChild size="lg" className="rounded-full px-8">
                        <Link href={`/${lang}/auth/register`}>
                            {dictionary.joinNow}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="ghost" className="rounded-full px-8">
                        <Link href={`/${lang}/subscriptions`}>{dictionary.explorePlans}</Link>
                    </Button>
                </div>
            </div>
            {backgroundImageUrl ? (
                <div className="relative aspect-square overflow-hidden rounded-3xl bg-muted md:aspect-[4/3] lg:aspect-square">
                    <Image
                        src={backgroundImageUrl}
                        alt={`${branding.appName} hero`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                    />
                </div>
            ) : (
                <div 
                    className="relative aspect-square overflow-hidden rounded-3xl md:aspect-[4/3] lg:aspect-square bg-[--hero-bg-color]" 
                     
                    style={{ '--hero-bg-color': backgroundColor || '#10b981' } as React.CSSProperties} 
                />
            )}
        </section>
    );
}
