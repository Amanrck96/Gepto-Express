import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="prose max-w-none dark:prose-invert">
          <p>
            Your privacy is important to us. It is Gepto Express&apos;s policy to respect your privacy regarding any information we may collect from you across our website, geptoexpress.example.com, and our mobile application.
          </p>

          <h2>1. Information We Collect</h2>
          <h3>Log data</h3>
          <p>
            When you visit our website or use our application, our servers may automatically log the standard data provided by your web browser or device. This data is considered “non-identifying information,” as it does not personally identify you on its own. It may include your device’s Internet Protocol (IP) address, your browser type and version, the pages you visit, the time and date of your visit, the time spent on each page, and other details.
          </p>
          <h3>Personal information</h3>
          <p>We may ask for personal information, such as your:</p>
          <ul>
            <li>Name</li>
            <li>Email</li>
            <li>Phone/mobile number</li>
            <li>Home/Mailing address (specifically within Cooch Behar for service delivery)</li>
            <li>Payment information</li>
            <li>Geolocation data (when using the app, for delivery purposes within Cooch Behar)</li>
          </ul>
          <p>
            This data is considered “identifying information,” as it can personally identify you. We only request personal information relevant to providing you with a service and only use it to help provide or improve this service.
          </p>

          <h2>2. How We Collect Information</h2>
          <p>
            We collect information by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used. You are free to refuse our request for your information, with the understanding that we may be unable to provide you with some of your desired services.
          </p>

          <h2>3. Use of Information</h2>
          <p>We may use a combination of identifying and non-identifying information to:</p>
          <ul>
            <li>Process your orders and facilitate delivery within Cooch Behar.</li>
            <li>Provide you with our core features and services.</li>
            <li>Communicate with you regarding your orders, account, or customer support inquiries.</li>
            <li>Personalize your experience on our platform.</li>
            <li>Conduct analytics to understand how our service is used and improve it.</li>
            <li>Process payments.</li>
            <li>Prevent fraud and ensure the security of our platform.</li>
          </ul>

          <h2>4. Data Processing and Storage</h2>
          <p>
            The personal information we collect is stored and processed in India, or where we or our partners, affiliates, and third-party providers maintain facilities. We only transfer data within jurisdictions subject to data protection laws that reflect our commitment to protecting the privacy of our users.
          </p>
          <p>
            We only retain personal information for as long as necessary to provide a service, or to improve our services in the future. While we retain this data, we will protect it within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.
          </p>

          <h2>5. Third-Party Access to Information</h2>
          <p>We may use third-party services for:</p>
          <ul>
            <li>Analytics tracking</li>
            <li>Payment processing</li>
            <li>Map and navigation services (for delivery)</li>
            <li>Authentication services (Google/Facebook login)</li>
            <li>Marketing and advertising</li>
          </ul>
          <p>
            These services may access our data solely for the purpose of performing specific tasks on our behalf. We do not share any personally identifying information with them without your explicit consent. We do not give them permission to disclose or use any of our data for any other purpose.
          </p>

          <h2>6. Your Rights and Controlling Your Personal Information</h2>
          <p>
            You have the right to review, update, or delete your personal information. You can typically manage your account information within the app settings. For other requests or if you have concerns about your privacy, please contact us.
          </p>

          <h2>7. Cookies</h2>
          <p>
            We use “cookies” to collect information about you and your activity across our site. A cookie is a small piece of data that our website stores on your computer, and accesses each time you visit, so we can understand how you use our site. This helps us serve you content based on preferences you have specified.
          </p>

          <h2>8. Children’s Privacy</h2>
          <p>
            Our services are not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13.
          </p>

          <h2>9. Changes to our Privacy Policy</h2>
          <p>
            At our discretion, we may change our privacy policy to reflect current acceptable practices. We will take reasonable steps to let users know about changes via our website or application. Your continued use of this site after any changes to this policy will be regarded as acceptance of our practices around privacy and personal information.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            For any questions or concerns regarding your privacy, you may contact us using the details on our Contact Us page.
          </p>

          <p><em>Last updated: [Current Date]</em></p>
        </CardContent>
      </Card>
    </div>
  );
}
