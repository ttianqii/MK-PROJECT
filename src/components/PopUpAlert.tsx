import Swal, { SweetAlertIcon } from "sweetalert2";

let timerInterval: ReturnType<typeof setInterval> | undefined;

// Animated icon per alert type (public/*.gif), used unless a call overrides
// it via options.imageUrl. Keeps every PopUpAlert call site consistent
// without having to pass the same image path everywhere.
const DEFAULT_ICON_IMAGES: Partial<Record<SweetAlertIcon, string>> = {
  success: "/save.gif",
  error: "/error.gif",
  warning: "/warning.gif",
};

interface PopUpAlertOptions {
  /** Recolor a built-in icon (success/error/…). Ignored when imageUrl is set. */
  iconColor?: string;
  /** Show a custom image (e.g. an animated gif) instead of the built-in icon. */
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export default function PopUpAlert(
  title: string,
  html: string,
  icon: SweetAlertIcon,
  options: PopUpAlertOptions = {}
) {
  const {
    iconColor,
    imageUrl = DEFAULT_ICON_IMAGES[icon],
    imageWidth = 96,
    imageHeight = 96,
  } = options;
  Swal.fire({
    title,
    html,
    timer: 2500,
    timerProgressBar: true,
    icon: imageUrl ? undefined : icon,
    iconColor,
    imageUrl,
    imageWidth,
    imageHeight,
    imageAlt: title,
    showConfirmButton: false,
    didOpen: () => {
      const b = Swal.getHtmlContainer()?.querySelector("b");
      if (b) {
        timerInterval = setInterval(() => {
          const timerLeft = Swal.getTimerLeft();
          if (timerLeft !== null && b) {
            b.textContent = timerLeft?.toString() as string;
          }
        }, 100);
      }
    },
    willClose: () => {
      clearInterval(timerInterval);
    },
  });
}
