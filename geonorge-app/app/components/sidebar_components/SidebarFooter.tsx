import * as React from "react";
import { useState } from "react";
import { ExternalLink, HelpCircle, Mail, Phone, Shield } from "lucide-react";
import { LanguageSelector } from "@/app/components/sidebar_components/LanguageSelector";
import { Language, TranslationKey } from "@/i18n/translations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface SidebarFooterProps {
  language: Language;
  handleLanguageChange: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  language,
  handleLanguageChange,
  t,
}) => {
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const footerLinks = [
    { title: t("tips_and_tricks"), url: "#", icon: HelpCircle },
    {
      title: t("contact_us"),
      url: "#",
      icon: Mail,
      onClick: () => setContactDialogOpen(true),
    },
    {
      title: t("privacy"),
      url: "#",
      icon: Shield,
      onClick: () => setPrivacyDialogOpen(true),
    },
  ];

  return (
    <div className="border-t bg-white flex-shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {footerLinks.map((item, index) => (
            <a
              target={item.onClick ? undefined : "_blank"}
              key={index}
              href={item.onClick ? "#" : item.url}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
              }}
              className="flex flex-col items-center p-2 rounded-omar hover:bg-gray-50 transition-colors gap-1 cursor-pointer"
              title={item.title}
            >
              <div className="bg-color-gn-primary/10 rounded-full p-1.5">
                <item.icon className="h-4 w-4 text-color-gn-primary" />
              </div>
              <span className="text-xs text-gray-600 text-center truncate w-full">
                {item.title}
              </span>
            </a>
          ))}
        </div>

        <LanguageSelector
          language={language}
          handleLanguageChange={handleLanguageChange}
        />

        {/* Privacy Dialog */}
        <AlertDialog
          open={privacyDialogOpen}
          onOpenChange={setPrivacyDialogOpen}
        >
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Personvern og cookies</AlertDialogTitle>
            </AlertDialogHeader>

            <div className="py-2 space-y-4">
              Les hvordan vi tar vare på personopplysninger i{" "}
              <a
                href="https://www.kartverket.no/om-kartverket/personvern"
                target="_blank"
                rel="noopener noreferrer"
                className="text-color-gn-primary hover:underline font-medium"
              >
                Kartverkets personvernerklæring
              </a>
            </div>

            <AlertDialogFooter>
              <Button
                variant="standard"
                onClick={() => setPrivacyDialogOpen(false)}
              >
                Lukk
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Contact Us Dialog */}
        <AlertDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
        >
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-color-gn-secondary">
                Kontakt oss
              </AlertDialogTitle>
            </AlertDialogHeader>

            <div className="py-2 space-y-4">
              <p className="font-medium text-color-gn-secondary">
                Synspunkter eller feil?
              </p>

              <p className="text-color-gn-secondary">
                Har du ris, ros eller tips vedrørende norgeskart.no, er vi
                takknemlige for innspill. Du kan kontakte oss på følgende måter:
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-color-gn-primary" />
                  <span>
                    Telefon:{" "}
                    <a
                      href="tel:+4732118000"
                      className="text-color-gn-secondary hover:underline"
                    >
                      32 11 80 00
                    </a>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-color-gn-primary" />
                  <span>
                    E-post:{" "}
                    <a
                      href="mailto:post@kartverket.no"
                      className="text-color-gn-secondary hover:underline"
                    >
                      post@kartverket.no
                    </a>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <a
                  href="https://forms.office.com/e/Zmsz9J4ELX?origin=lprLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-color-gn-primary hover:underline font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Gå til tilbakemeldingsskjema</span>
                </a>
              </div>
            </div>

            <AlertDialogFooter>
              <Button
                variant="standard"
                onClick={() => setContactDialogOpen(false)}
              >
                Lukk
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
