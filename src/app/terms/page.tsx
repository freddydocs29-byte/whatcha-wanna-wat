import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Watcha Wanna Eat?",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: "#897E73", marginBottom: 48 }}>
          Effective date: June 27, 2026
        </p>

        <Section title="1. Agreement to Terms">
          <p>
            By downloading, accessing, or using Watcha Wanna Eat? (the
            "App"), you agree to be bound by these Terms of Service ("Terms").
            If you do not agree, do not use the App.
          </p>
        </Section>

        <Section title="2. Who Can Use the App">
          <p>
            The App is intended for users who are 13 years of age or older.
            Users under 18 must have permission from a parent or legal guardian
            to use the App. By using the App, you represent that you meet
            these age requirements.
          </p>
        </Section>

        <Section title="3. Your Account">
          <p>
            You may create an account using an email address and password or
            through Google Sign-In. You are responsible for maintaining the
            confidentiality of your account credentials and for all activity
            that occurs under your account. Notify us immediately at{" "}
            <a href="mailto:info@watchawannaeat.com" style={{ color: "#E8621A" }}>
              info@watchawannaeat.com
            </a>{" "}
            if you suspect unauthorized access.
          </p>
          <p style={{ marginTop: 12 }}>
            We may suspend or terminate accounts that violate these Terms or
            that appear to be inactive for an extended period.
          </p>
        </Section>

        <Section title="4. What the App Does">
          <p>
            Watcha Wanna Eat? is a meal decision engine. It helps you and
            your partner choose what to eat by presenting meal options and
            recording your preferences. It is not a food delivery service,
            restaurant guide, nutrition advisor, or medical resource.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong style={{ color: "#F6EEE2" }}>
              Allergen filtering — important limitation:
            </strong>{" "}
            The App helps filter meals that may contain your selected
            allergens. This feature is intended as a convenience tool only. It
            is not a substitute for reading ingredient labels, verifying
            preparation methods with a restaurant or retailer, or consulting a
            qualified healthcare provider. We do not guarantee that filtered
            results will be free of any allergen. Do not rely on this App as
            your sole source of allergen information.
          </p>
        </Section>

        <Section title="5. User Conduct">
          <p>You agree not to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 1.8 }}>
            <li>Use the App for any unlawful purpose</li>
            <li>Attempt to reverse-engineer, scrape, or disrupt the App</li>
            <li>
              Impersonate another person or create a false identity in the App
            </li>
            <li>
              Upload or transmit any content that is harmful, offensive, or
              violates the rights of others
            </li>
          </ul>
        </Section>

        <Section title="6. Intellectual Property">
          <p>
            All content, branding, design, and software in the App are owned
            by or licensed to Watcha Wanna Eat? and are protected by
            applicable intellectual property laws. You may not reproduce,
            distribute, or create derivative works without our prior written
            permission.
          </p>
          <p style={{ marginTop: 12 }}>
            You retain ownership of any content you submit (such as feedback).
            By submitting content, you grant us a non-exclusive, royalty-free
            license to use it to operate and improve the App.
          </p>
        </Section>

        <Section title="7. Privacy">
          <p>
            Your use of the App is also governed by our{" "}
            <Link href="/privacy" style={{ color: "#E8621A" }}>
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference. Please
            review it to understand our data practices.
          </p>
        </Section>

        <Section title="8. Third-Party Services">
          <p>
            The app may use services such as Supabase, Vercel, OpenAI, Google,
            and Microsoft 365 to operate, host, analyze, communicate, or
            improve the app. These third parties have their own terms and
            privacy policies, and we are not responsible for their practices.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The App is provided "as is" and "as available" without warranties
            of any kind, express or implied, including warranties of
            merchantability, fitness for a particular purpose, or
            non-infringement. We do not warrant that the App will be
            uninterrupted, error-free, or free of harmful components.
          </p>
          <p style={{ marginTop: 12 }}>
            Meal suggestions are generated algorithmically or by AI and are
            for entertainment and convenience purposes only. They do not
            constitute dietary, nutritional, or medical advice.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            To the fullest extent permitted by applicable law, Watcha Wanna
            Eat? and its operators will not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising
            out of your use of or inability to use the App — even if we have
            been advised of the possibility of such damages.
          </p>
          <p style={{ marginTop: 12 }}>
            Our total liability to you for any claim arising out of or relating
            to these Terms or the App will not exceed the greater of $10 or
            the amount you paid us in the past six months.
          </p>
        </Section>

        <Section title="11. Changes to These Terms">
          <p>
            We may update these Terms from time to time. When we do, we will
            update the effective date at the top of this page. Continued use
            of the App after changes are posted constitutes your acceptance of
            the revised Terms.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms are governed by the laws of the State of Michigan,
            without regard to its conflict of law principles. Any disputes
            arising under these Terms will be resolved in the state or federal
            courts located in Michigan.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms? Reach us at{" "}
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
            <Link href="/privacy" style={{ color: "#897E73" }}>
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/terms" style={{ color: "#897E73" }}>
              Terms of Service
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
