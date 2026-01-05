window.IntelligenceUtils = {
    CACHE_KEY: 'cached_threat_level',

    /**
     * Synchronous function that returns cached threat data from localStorage.
     * Use this for instant UI rendering on page load.
     * Returns { score, status, label, cached: true } or default if no cache.
     */
    getLocalThreatLevel: function () {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                return { ...data, cached: true };
            }
        } catch (e) {
            console.warn('Failed to read cached threat level:', e);
        }
        return { score: 0, status: 'SECURE', label: 'Loading...', cached: true };
    },

    /**
     * Calculates the Hybrid Threat Score (Signal + Visual)
     * Replaces the old summation logic with a weighted ratio model.
     * Returns standard object: { score, status, label }
     * Also saves result to localStorage for cache-first strategy.
     */
    calculateThreatLevel: async function () {
        if (
            typeof SupabaseManager === "undefined" ||
            !SupabaseManager.getClient
        ) {
            console.error(
                "SupabaseManager not found. Ensure it is imported before intelligenceUtils.js",
            );
            return { score: 0, status: "SECURE", label: "Error ⚠️" };
        }

        const client = SupabaseManager.getClient();
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();

        try {
            const [eventsResponse, velocityResponse] = await Promise.all([
                client
                    .from("intel_events")
                    .select("event_type, headline, created_at")
                    .gte("created_at", startOfDay),
                client.rpc("get_ad_velocity_stats"),
            ]);

            const events = eventsResponse.data || [];
            const rawHistoricalAvg =
                velocityResponse.data &&
                velocityResponse.data.avg_daily_ads;
            const historicalAvg = rawHistoricalAvg && rawHistoricalAvg > 0 ? rawHistoricalAvg : 5;

            const adEvents = events.filter(
                (e) =>
                    e.event_type === "NEW_AD_LAUNCH" &&
                    e.headline &&
                    (e.headline.includes("Facebook") ||
                        e.headline.includes("Google")),
            );

            const adRatio = adEvents.length / historicalAvg;

            let adScore = 0;
            if (adRatio <= 1.0)
                adScore = 10;
            else if (adRatio <= 1.5)
                adScore = 30;
            else if (adRatio <= 2.0)
                adScore = 50;
            else adScore = 60;

            let visualScore = 0;
            let isHighValuePromo = false;

            const hasPromoDetected = events.some(e => e.event_type === "PROMO_DETECTED");
            const hasScreenshotCaptured = events.some(e => e.event_type === "SCREENSHOT_CAPTURED");

            if (hasPromoDetected) {
                visualScore = 40;
                isHighValuePromo = true;
            } else if (hasScreenshotCaptured) {
                visualScore = 10;
            }

            let totalScore = adScore + visualScore;

            if (adRatio > 2.0 && isHighValuePromo) {
                totalScore = 100;
            }

            totalScore = Math.min(totalScore, 100);

            let status, label;
            if (totalScore <= 30) {
                status = "SECURE";
                label = "Low 🟢";
            } else if (totalScore <= 70) {
                status = "ELEVATED";
                label = "Moderate 👀";
            } else {
                status = "CRITICAL";
                label = "HIGH 🔥";
            }

            const result = { score: totalScore, status, label };
            
            try {
                localStorage.setItem(this.CACHE_KEY, JSON.stringify(result));
            } catch (e) {
                console.warn('Failed to cache threat level:', e);
            }
            
            return result;
        } catch (error) {
            console.error("Threat Calculation Failed:", error);
            return { score: 0, status: "SECURE", label: "Error ⚠️" };
        }
    },
};
