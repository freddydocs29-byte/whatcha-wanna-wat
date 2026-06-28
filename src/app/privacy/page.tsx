import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Watcha Wanna Eat?",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        backgroundColor: "#0B0805",
        minHeight: "100dvh",
        color: "#F6EEE2",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        {/* Back nav */}
        <Link
          href="/auth"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#897E73",
            fontSize: 14,
            textDecoration: "none",
            marginBottom: 40,
          }}
        >
          ← Back
        </Link>

        {/* Header */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#F6EEE2",
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: "#897E73", marginBottom: 48 }}>
          Effective date: June 27, 2026
        </p>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: "rgba(246,238,226,0.85)",
            marginBottom: 40,
          }}
        >
          Watcha Wanna Eat? ("we," "our," or "us") is committed to being
          transparent about how we collect and use information. This Privacy
          Policy explains what we collect, why we collect it, and how you can
          manage it.
        </p>

        <Section title="1. Information We Collect">
          <p>We collect the following categories of information:</p>

          <SubHeading>Account</SubHeading>
          <p>
            Email address, hashed password (for email/password sign-up), and
            Google OAuth identifier (for Google Sign-In). We do not store your
            Google password.
          </p>

          <SubHeading>Profile</SubHeading>
          <p>
            Display name, avatar, taste preferences, dietary restrictions,
            allergen selections, and onboarding completion status that you
            provide during setup.
          </p>

          <SubHeading>Behavioral</SubHeading>
          <p>
            Swipe history (liked/disliked meals), matched meals, session
            history, couples flavor type result, and return visit timestamps.
            This data is used to personalize your experience.
          </p>

          <SubHeading>Session</SubHeading>
          <p>
            Shared session IDs, session codes used to link partners, partner
            linkage data, and deck composition for couples sessions.
          </p>

          <SubHeading>Analytics</SubHeading>
          <p>
            Anonymized internal events including app opens, session starts,
            deck interactions, onboarding steps completed, and friction signals
            (e.g., where users drop off). These events are stored internally.
            We do not use third-party analytics SDKs.
          </p>

          <SubHeading>Feedback</SubHeading>
          <p>
            Content of any feedback you submit through the App, along with
            your account identifier and a timestamp.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 1.8 }}>
            <li>Create and manage your account</li>
            <li>Personalize meal suggestions based on your preferences</li>
            <li>Enable couples sessions and partner matching</li>
            <li>
              Apply allergen filters to meal results (subject to the important
              limitation described in Section 4)
            </li>
            <li>Improve the App based on aggregated, anonymized usage data</li>
            <li>Respond to feedback and support requests</li>
            <li>Maintain the security and integrity of the App</li>
          </ul>
        </Section>

        <Section title="3. How We Share Your Information">
          <p>
            The app may use services such as Supabase, Vercel, OpenAI, Google,
            and Microsoft 365 to operate, host, analyze, communicate, or
            improve the app. These services receive only the data necessary
            for their specific function and are subject to their own privacy
            policies.
          </p>
          <p style={{ marginTop: 12 }}>
            We do not sell your personal information to third parties. We do
            not use your data for ad targeting.
          </p>
          <p style={{ marginTop: 12 }}>
            We may disclose information if required by law, regulation, or
            valid legal process, or to protect the rights and safety of our
            users or the public.
          </p>
        </Section>

        <Section title="4. Allergen Filtering — Important Limitation">
          <p>
            The App helps filter meals that may contain your selected
            allergens. This feature is a convenience tool only and is{" "}
            <strong style={{ color: "#F6EEE2" }}>
              not a substitute for reading ingredient labels or consulting a
              healthcare provider
            </strong>
            . Meal data is sourced algorithmically and may be incomplete or
            inaccurate. We cannot guarantee that any filtered result will be
            free of a specific allergen.
          </p>
          <p style={{ marginTop: 12 }}>
            Do not rely on this App as your sole source of allergen
            information. Always verify with the restaurant, food manufacturer,
            or a qualified healthcare professional before consuming food if
            you have a serious allergy or dietary medical need.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We retain your account and profile data for as long as your
            account is active. Anonymized analytics data may be retained
            indefinitely in aggregated form. If you delete your account, we
            will delete or anonymize your personal data within a reasonable
            period, except where we are required to retain it by law.
          </p>
        </Section>

        <Section title="6. Children's Privacy">
          <p>
            The App is not directed at children under 13. We do not knowingly
            collect personal information from children under 13. If we learn
            that we have collected personal information from a child under 13,
            we will delete it promptly. If you believe we may have collected
            such information, please contact us at{" "}
            <a href="mailto:info@watchawannaeat.com" style={{ color: "#E8621A" }}>
              info@watchawannaeat.com
            </a>
            .
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on where you live, you may have the right to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 1.8 }}>
            <li>
              <strong style={{ color: "#F6EEE2" }}>Access</strong> the personal
              information we hold about you
            </li>
            <li>
              <strong style={{ color: "#F6EEE2" }}>Correct</strong> inaccurate
              information
            </li>
            <li>
              <strong style={{ color: "#F6EEE2" }}>Delete</strong> your account
              and associated data
            </li>
            <li>
              <strong style={{ color: "#F6EEE2" }}>Opt out</strong> of
              marketing communications (we do not currently send marketing
              emails, but you may opt out at any time)
            </li>
          </ul>
          <p style={{ marginTop: 12 }}>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:info@watchawannaeat.com" style={{ color: "#E8621A" }}>
              info@watchawannaeat.com
            </a>
            .
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            We use industry-standard measures to protect your information,
            including encrypted transmission (HTTPS), hashed password storage,
            and access controls on our database. No system is perfectly
            secure. We cannot guarantee the absolute security of your
            information and are not responsible for unauthorized access beyond
            our reasonable control.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we do,
            we will update the effective date at the top of this page.
            Continued use of the App after changes are posted constitutes your
            acceptance of the revised policy.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about this Privacy Policy? Reach us at{" "}
            <a href="mailto:info@watchawannaeat.com" style={{ color: "#E8621A" }}>
              info@watchawannaeat.com
            </a>
            .
          </p>
        </Section>

        {/* Footer */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: "1px solid rgba(137,126,115,0.2)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, color: "#897E73" }}>
            <Link href="/terms" style={{ color: "#897E73" }}>
              Terms of Service
            </Link>
            {" · "}
            <Link href="/privacy" style={{ color: "#897E73" }}>
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#E8621A",
          marginBottom: 12,
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "rgba(246,238,226,0.85)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "#897E73",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginTop: 16,
        marginBottom: 6,
      }}
    >
      {children}
    </p>
  );
}
