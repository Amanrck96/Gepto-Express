import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="prose max-w-none dark:prose-invert">
          <h2>1. Introduction</h2>
          <p>
            Welcome to Gepto Express! These terms and conditions outline the rules and regulations for the use of Gepto Express&apos;s Website and Mobile Application, located at geptoexpress.example.com.
          </p>
          <p>
            By accessing this website and/or application we assume you accept these terms and conditions. Do not continue to use Gepto Express if you do not agree to take all of the terms and conditions stated on this page.
          </p>

          <h2>2. Service Area</h2>
          <p>
            Gepto Express currently provides services exclusively within the municipal limits of <strong>Cooch Behar, West Bengal, India</strong>. We reserve the right to expand or modify our service area at any time without prior notice. Orders placed for delivery outside this area will be cancelled.
          </p>

          <h2>3. Accounts</h2>
          <p>
            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
          <p>
            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service.
          </p>

          <h2>4. Orders and Payment</h2>
          <p>
            All orders are subject to availability and acceptance by us. We reserve the right to refuse or cancel any order for any reason, including limitations on quantities available for purchase, inaccuracies, or errors in product or pricing information, or problems identified by our credit and fraud avoidance department.
          </p>
          <p>
            Payment can be made through various methods available on the platform, including UPI, credit/debit cards, e-wallets, and Cash on Delivery (COD), subject to availability and specific order conditions.
          </p>

          <h2>5. Delivery</h2>
          <p>
            We aim to deliver your order within the estimated delivery time provided, but delivery times are estimates and cannot be guaranteed. Factors such as traffic, weather conditions, and order volume can affect delivery times.
          </p>
          <p>
           You are responsible for providing an accurate delivery address within Cooch Behar and ensuring someone is available to receive the order.
          </p>

          <h2>6. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are and will remain the exclusive property of Gepto Express and its licensors.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            In no event shall Gepto Express, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
          </p>

          <h2>8. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions, and specifically within the jurisdiction of courts in Cooch Behar, West Bengal.
          </p>

          <h2>9. Changes</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days&apos; notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us via the Contact Us page.
          </p>

          <p><em>Last updated: [Current Date]</em></p>

        </CardContent>
      </Card>
    </div>
  );
}
