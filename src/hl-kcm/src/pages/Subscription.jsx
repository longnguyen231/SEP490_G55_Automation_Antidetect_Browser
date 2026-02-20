import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";
import { ChevronLeft, Check, Users, Zap } from "lucide-react";

/** MOCK PLANS + API hook (đổi sau) */
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    profileLimit: 10,
    price: 19.99,
    billingCycle: "month",
    gradient: "linear-gradient(135deg, rgba(148,163,184,.65), rgba(71,85,105,.65))",
    description: "Essential for individual use",
    features: ["Up to 10 browser profiles", "Basic profile management", "Email support", "Standard backup"],
  },
  {
    id: "growth",
    name: "Growth",
    profileLimit: 100,
    price: 59.99,
    billingCycle: "month",
    gradient: "linear-gradient(135deg, rgba(59,130,246,.75), rgba(34,211,238,.65))",
    description: "For growing teams",
    features: ["Up to 100 browser profiles", "Advanced profile management", "Priority support", "Enhanced backup & sync", "Team dashboard", "API access"],
    badge: "Most Popular",
  },
  {
    id: "scale",
    name: "Scale",
    profileLimit: 1000,
    price: 199.99,
    billingCycle: "month",
    gradient: "linear-gradient(135deg, rgba(168,85,247,.75), rgba(236,72,153,.55))",
    description: "For enterprise deployments",
    features: ["Unlimited browser profiles", "Full automation suite", "24/7 dedicated support", "Advanced backup & redundancy", "Multi-team management", "Custom API integrations", "SLA guarantee"],
  },
];

async function apiGetPlans() {
  // sau này: return fetch(...).then(r=>r.json())
  return new Promise((r) => setTimeout(() => r(PLANS), 120));
}

export default function Subscription({ onBack }) {
  const [plans, setPlans] = useState(PLANS);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [teamMembers, setTeamMembers] = useState(1);
  const [validityMonths, setValidityMonths] = useState(1);

  useEffect(() => {
    let alive = true;
    apiGetPlans().then((p) => alive && setPlans(p));
    return () => (alive = false);
  }, []);

  const currentPlan = useMemo(() => plans.find((p) => p.id === selectedPlan), [plans, selectedPlan]);
  const monthlyPrice = currentPlan?.price ?? 0;
  const totalPrice = monthlyPrice * validityMonths;

  return (
    <div className="h-100 overflow-auto px-4 px-lg-5 py-4">
      <div className="mb-4 d-flex align-items-center justify-content-between">
        <div>
          <div className="fw-bold" style={{ fontSize: 34, letterSpacing: -0.6 }}>
            Upgrade Your Account
          </div>
          <div className="k-muted">Select a plan and configure your setup. Upgrade or downgrade anytime.</div>
        </div>

        <Button className="k-btn-ghost d-flex align-items-center gap-2" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </Button>
      </div>

      <Container fluid="lg">
        <Row className="g-4">
          {/* Plans */}
          <Col lg={8}>
            <div className="fw-semibold mb-3" style={{ fontSize: 16 }}>
              Available Plans
            </div>

            <Row className="g-3">
              {plans.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <Col md={6} key={plan.id}>
                    <Card className={`k-card k-plan ${isSelected ? "selected" : ""}`} onClick={() => setSelectedPlan(plan.id)}>
                      <div className="glow" style={{ background: plan.gradient }} />
                      <div className="p-4 position-relative">
                        {plan.badge ? (
                          <div className="mb-2">
                            <span className="k-pill k-badge">{plan.badge}</span>
                          </div>
                        ) : null}

                        <div className="mb-2">
                          <div className="fw-bold" style={{ fontSize: 20 }}>
                            {plan.name}
                          </div>
                          <div className="k-muted" style={{ fontSize: 12 }}>
                            {plan.description}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="d-flex align-items-end gap-1">
                            <div className="fw-bold" style={{ fontSize: 34 }}>
                              ${plan.price}
                            </div>
                            <div className="k-muted" style={{ fontSize: 14 }}>
                              /{plan.billingCycle}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 pb-3 mb-3 border-bottom" style={{ borderColor: "var(--border)" }}>
                          <Zap size={16} style={{ color: "var(--accent)" }} />
                          <div className="fw-semibold">
                            {plan.profileLimit === 1000 ? "Unlimited" : plan.profileLimit} profiles
                          </div>
                        </div>

                        <div className="d-grid gap-2" style={{ fontSize: 13 }}>
                          {plan.features.slice(0, 3).map((f) => (
                            <div key={f} className="d-flex gap-2 align-items-start">
                              <Check size={16} style={{ color: "var(--accent)", marginTop: 2 }} />
                              <div style={{ opacity: 0.9 }}>{f}</div>
                            </div>
                          ))}
                          {plan.features.length > 3 ? (
                            <div className="k-muted fst-italic" style={{ fontSize: 12 }}>
                              +{plan.features.length - 3} more features
                            </div>
                          ) : null}
                        </div>

                        <Button className={`w-100 mt-3 ${isSelected ? "k-btn-accent" : "k-btn-ghost"}`}>
                          {isSelected ? "✓ Selected" : "Choose Plan"}
                        </Button>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Col>

          {/* Setup */}
          <Col lg={4}>
            {currentPlan && (
              <Card className="k-card k-sticky">
                <div className="p-4">
                  <div className="fw-bold mb-3" style={{ fontSize: 18 }}>
                    Your Setup
                  </div>

                  <div className="pb-3 mb-3 border-bottom" style={{ borderColor: "var(--border)" }}>
                    <div className="k-muted text-uppercase" style={{ fontSize: 11, letterSpacing: 0.8 }}>
                      Selected Plan
                    </div>
                    <div className="fw-bold" style={{ fontSize: 22, color: "var(--accent)" }}>
                      {currentPlan.name}
                    </div>
                    <div className="k-muted" style={{ fontSize: 12 }}>
                      {currentPlan.description}
                    </div>
                  </div>

                  <div className="pb-3 mb-3 border-bottom" style={{ borderColor: "var(--border)" }}>
                    <div className="k-muted text-uppercase mb-2" style={{ fontSize: 11, letterSpacing: 0.8 }}>
                      Billing Period
                    </div>
                    <div className="d-flex gap-2">
                      {[1, 3, 6, 12].map((m) => (
                        <button
                          type="button"
                          key={m}
                          onClick={() => setValidityMonths(m)}
                          className="k-btn-ghost"
                          style={{
                            flex: 1,
                            padding: "10px 8px",
                            borderRadius: 12,
                            background: validityMonths === m ? "rgba(48,183,255,.14)" : "transparent",
                            borderColor: validityMonths === m ? "rgba(48,183,255,.35)" : "var(--border)",
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: 12 }}>{m}m</div>
                          {m === 12 ? <div className="k-muted" style={{ fontSize: 11 }}>-20%</div> : null}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pb-3 mb-3 border-bottom" style={{ borderColor: "var(--border)" }}>
                    <div className="k-muted text-uppercase mb-2 d-flex align-items-center gap-2" style={{ fontSize: 11, letterSpacing: 0.8 }}>
                      <Users size={14} /> Team Members
                    </div>
                    <div className="d-flex align-items-center gap-2 k-card-quiet p-2">
                      <button type="button" className="k-btn-ghost" style={{ width: 34, height: 34, borderRadius: 10 }} onClick={() => setTeamMembers((x) => Math.max(1, x - 1))}>
                        −
                      </button>
                      <Form.Control
                        className="k-input text-center"
                        value={teamMembers}
                        type="number"
                        min={1}
                        onChange={(e) => setTeamMembers(Math.max(1, parseInt(e.target.value || "1", 10)))}
                      />
                      <button type="button" className="k-btn-ghost" style={{ width: 34, height: 34, borderRadius: 10 }} onClick={() => setTeamMembers((x) => x + 1)}>
                        +
                      </button>
                    </div>
                    <div className="k-muted mt-2" style={{ fontSize: 12 }}>
                      (UI only) You can use this later for pricing rules.
                    </div>
                  </div>

                  <div className="k-card-quiet p-3 mb-3">
                    <div className="d-flex justify-content-between mb-2">
                      <div className="k-muted">Monthly Rate</div>
                      <div className="fw-semibold">${monthlyPrice}</div>
                    </div>
                    <div className="d-flex justify-content-between pb-2 mb-2 border-bottom" style={{ borderColor: "var(--border)" }}>
                      <div className="k-muted">Period ({validityMonths} months)</div>
                      <div className="fw-semibold">{validityMonths}x</div>
                    </div>
                    <div className="d-flex justify-content-between align-items-end">
                      <div className="fw-semibold">Total Cost</div>
                      <div className="fw-bold" style={{ fontSize: 28, color: "var(--accent)" }}>
                        ${totalPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="d-grid gap-2">
                    <Button className="k-btn-accent">Continue to Checkout</Button>
                    <Button className="k-btn-ghost">Save Configuration</Button>
                  </div>

                  <div className="k-muted text-center mt-3" style={{ fontSize: 12 }}>
                    Billed on the first of each period. Cancel anytime.
                  </div>
                </div>
              </Card>
            )}
          </Col>
        </Row>

        <Card className="k-card mt-4">
          <div className="p-4 p-lg-5">
            <div className="fw-semibold mb-3" style={{ fontSize: 18 }}>
              What&apos;s Included
            </div>
            <Row className="g-4">
              <Col md={4}>
                <div className="d-flex align-items-center gap-2 fw-semibold mb-2">
                  <Zap size={16} style={{ color: "var(--accent)" }} /> Browser Profiles
                </div>
                <div className="k-muted">Create and manage isolated browser profiles for different purposes with full customization.</div>
              </Col>
              <Col md={4}>
                <div className="d-flex align-items-center gap-2 fw-semibold mb-2">
                  <Users size={16} style={{ color: "var(--accent)" }} /> Team Collaboration
                </div>
                <div className="k-muted">Invite team members and share profiles across your organization securely.</div>
              </Col>
              <Col md={4}>
                <div className="d-flex align-items-center gap-2 fw-semibold mb-2">
                  <Check size={16} style={{ color: "var(--accent)" }} /> Priority Support
                </div>
                <div className="k-muted">Get help when you need it with our dedicated support team available 24/7.</div>
              </Col>
            </Row>
          </div>
        </Card>
      </Container>
    </div>
  );
}
