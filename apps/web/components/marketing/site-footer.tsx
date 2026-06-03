import { Facebook, Linkedin, Twitter, Mail, Phone, MapPin } from 'lucide-react';

export function MarketingSiteFooter() {
  return (
    <footer className="w-full bg-[#061F18] text-white">
      <div className="mx-auto flex min-h-[587px] max-w-[1440px] flex-col px-8 py-14 md:px-14">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.5fr_2fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-display text-4xl font-bold">KO Platform</h3>
              <p className="max-w-md text-sm leading-7 text-white/80">
                The modern operating system for UK mortgage brokerages — pipeline, fact-finds,
                lender research and AI-generated suitability reports in one place.
              </p>
            </div>

            <div className="space-y-3 text-sm text-white/85">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> hello@kobrokers.co.uk
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> +44 (0)20 1234 5678
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> 1 Finsbury Avenue, London EC2M 2PP
              </div>
            </div>

            <div className="flex items-center gap-3">
              {[Facebook, Linkedin, Twitter].map((Icon, idx) => (
                <div key={idx} className="rounded-full border border-white/45 p-2">
                  <Icon className="h-3.5 w-3.5 text-white/90" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-white">Platform</h4>
              <p className="text-white/80">Pipeline CRM</p>
              <p className="text-white/80">Smart Fact-Find</p>
              <p className="text-white/80">Lender Research</p>
              <p className="text-white/80">Compliance Vault</p>
              <p className="text-white/80">AI Reports</p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-white">Company</h4>
              <p className="text-white/80">About KO</p>
              <p className="text-white/80">Our Brokers</p>
              <p className="text-white/80">Careers</p>
              <p className="text-white/80">Press</p>
              <p className="text-white/80">Contact</p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-white">Resources</h4>
              <p className="text-white/80">Pricing</p>
              <p className="text-white/80">Help Centre</p>
              <p className="text-white/80">API Docs</p>
              <p className="text-white/80">Changelog</p>
              <p className="text-white/80">Status</p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-white">Legal</h4>
              <p className="text-white/80">Privacy Policy</p>
              <p className="text-white/80">Terms of Service</p>
              <p className="text-white/80">Cookie Policy</p>
              <p className="text-white/80">FCA Disclosures</p>
              <p className="text-white/80">Data Protection</p>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/30 pt-6">
          <div className="grid grid-cols-1 gap-8 text-xs text-white/80 md:grid-cols-3 md:gap-x-16 md:gap-y-6">
            <div>
              <p className="font-semibold text-white">Authorised & Regulated</p>
              <p>
                KO Brokers Ltd is authorised and regulated by the Financial Conduct Authority. FCA
                Reference No. 000000.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">Registered Office</p>
              <p>
                KO Brokers Ltd, 1 Finsbury Avenue, London EC2M 2PP (registered in England & Wales
                No. 00000000).
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">Data Protection</p>
              <p>
                ISO 27001 aligned. Registered with the ICO under the Data Protection Act 2018. Reg.
                No. ZA000000.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-white/25 pt-5 text-xs text-white/70">
          <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
            <p>© 2026 KO Realtors · Powered by Luxcity Technology</p>
            <div className="flex gap-5">
              <p>Privacy</p>
              <p>Terms</p>
              <p>Cookies</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
