import { Navigate } from "react-router-dom";
import { getAuthSession, getUserInitials, hasActiveSession } from "../utils/auth";

export default function ProfileSettings() {
	if (!hasActiveSession()) {
		return <Navigate to="/login" replace />;
	}

	const user = getAuthSession();

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	const initials = getUserInitials(user.name, user.email);

	return (
		<div
			style={{
				minHeight: "100vh",
				padding: "140px 20px 60px",
				background: "linear-gradient(180deg, #eefaf8 0%, #f7fcfb 100%)",
			}}
		>
			<div
				style={{
					maxWidth: "720px",
					margin: "0 auto",
					background: "#ffffff",
					borderRadius: "28px",
					boxShadow: "0 24px 60px rgba(10, 109, 98, 0.12)",
					padding: "36px",
					border: "1px solid #d7ebe7",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
					<div
						style={{
							width: "84px",
							height: "84px",
							borderRadius: "50%",
							background: "linear-gradient(135deg, #0a6d62 0%, #1db7a6 100%)",
							color: "#ffffff",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: "28px",
							fontWeight: 800,
							letterSpacing: "0.08em",
							boxShadow: "0 14px 32px rgba(10, 109, 98, 0.25)",
						}}
					>
						{initials}
					</div>

					<div>
						<p style={{ color: "#0a6d62", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "12px", marginBottom: "8px" }}>
							Account Information
						</p>
						<h1 style={{ fontSize: "36px", color: "#083c37", marginBottom: "8px" }}>{user.name || "MediCheck User"}</h1>
						<p style={{ color: "#4f6b67", fontSize: "17px" }}>{user.email}</p>
					</div>
				</div>

				<div
					style={{
						marginTop: "30px",
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
						gap: "16px",
					}}
				>
					<div style={{ background: "#f4fbfa", borderRadius: "18px", padding: "20px", border: "1px solid #d7ebe7" }}>
						<p style={{ color: "#67807c", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
							Full Name
						</p>
						<p style={{ color: "#083c37", fontSize: "20px", fontWeight: 700 }}>{user.name || "Not provided"}</p>
					</div>

					<div style={{ background: "#f4fbfa", borderRadius: "18px", padding: "20px", border: "1px solid #d7ebe7" }}>
						<p style={{ color: "#67807c", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
							Email Address
						</p>
						<p style={{ color: "#083c37", fontSize: "20px", fontWeight: 700, wordBreak: "break-word" }}>{user.email}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
