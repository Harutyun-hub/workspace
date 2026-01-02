window.IntelligenceUtils = {
    /**
     * Calculates the Hybrid Threat Score (Signal + Visual)
     * Replaces the old summation logic with a weighted ratio model.
     * Returns standard object: { score, status, label }
     */
    calculateThreatLevel: async function () {
        // Ensure SupabaseManager is loaded before running
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
            // 1. PARALLEL FETCHING: Get all data needed for the calculation
            // We fetch 3 things at once for performance
            const [eventsResponse, screenshotResponse, velocityResponse] =
                await Promise.all([
                    // A. Fetch Today's Events (Ads)
                    client
                        .from("intel_events")
                        .select("event_type, headline, created_at")
                        .gte("created_at", startOfDay),

                    // B. Fetch Today's Latest Screenshot Analysis
                    client
                        .from("company_screenshots")
                        .select(
                            "marketing_intent, ai_analysis, promotions_detected, created_at",
                        )
                        .gte("created_at", startOfDay)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .single(),

                    // C. Fetch Historical Baseline (7-Day Avg) via our new SQL Function
                    client.rpc("get_ad_velocity_stats"),
                ]);

            const events = eventsResponse.data || [];
            const latestScreenshot = screenshotResponse.data; // Can be null if no screenshot today
            const rawHistoricalAvg =
                velocityResponse.data &&
                velocityResponse.data.avg_daily_ads;
            const historicalAvg = rawHistoricalAvg && rawHistoricalAvg > 0 ? rawHistoricalAvg : 5;

            // --- PART A: AD VELOCITY SCORE (The Engine - 60% Weight) ---
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
                adScore = 10; // Normal Activity
            else if (adRatio <= 1.5)
                adScore = 30; // Push (Elevated)
            else if (adRatio <= 2.0)
                adScore = 50; // Spike (High)
            else adScore = 60; // Flood (Max)

            // --- PART B: VISUAL CONTEXT SCORE (The Fuel - 40% Weight) ---
            let visualScore = 0;
            let isHighValuePromo = false;

            if (latestScreenshot) {
                // Check 1: Did AI detect a promo?
                if (latestScreenshot.promotions_detected) {
                    visualScore += 20;
                }

                // Check 2: "Aggressive" Keyword Search
                // Fuses 'marketing_intent' and 'ai_analysis' text
                const combinedText = (
                    (latestScreenshot.marketing_intent || "") +
                    " " +
                    (latestScreenshot.ai_analysis || "")
                ).toUpperCase();
                const triggers = [
                    "WELCOME BONUS",
                    "BUN VENIT",
                    "FREE SPINS",
                    "ROTIRI",
                    "NO DEPOSIT",
                    "FARA DEPUNERE",
                    "RON",
                ];

                const hasTrigger = triggers.some((t) =>
                    combinedText.includes(t),
                );
                if (hasTrigger) {
                    visualScore += 20; // Max out visual score
                    isHighValuePromo = true;
                }
            }

            // --- PART C: THE NUCLEAR OVERRIDE ---
            // Logic: If massive ad spike (>2x) AND aggressive promo -> MAX THREAT
            let totalScore = adScore + visualScore;

            if (adRatio > 2.0 && isHighValuePromo) {
                totalScore = 100;
            }

            // Cap at 100
            totalScore = Math.min(totalScore, 100);

            // --- PART D: DETERMINE STATUS ---
            // Mapping score to UI labels (Green/Yellow/Red)
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

            return { score: totalScore, status, label };
        } catch (error) {
            console.error("Threat Calculation Failed:", error);
            // Fail safe: Return 0 (Secure) rather than breaking UI
            return { score: 0, status: "SECURE", label: "Error ⚠️" };
        }
    },
};
