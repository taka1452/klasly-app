import { redirect } from "next/navigation";

// Room bookings are now shown at /rooms (the default view)
export default function RoomBookingsRedirect() {
  redirect("/rooms");
}
