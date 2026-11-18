# Numerical Methodology & Tolerances — GRIDMATH 3D

All computational outputs in GRIDMATH 3D are evaluated in JavaScript IEEE-754 double precision (`float64`, $\varepsilon_{\text{mach}} \approx 2.22 \times 10^{-16}$) using explicit deterministic algorithms.

## 1. Linear Systems (`gaussianElimination.ts`, `numericalCore.ts`)
- **Algorithm**: Gaussian elimination with partial row pivoting ($|a_{r,k}| = \max_{i \ge k} |a_{i,k}|$) and back-substitution; secondary verification via `mathjs` `lusolve`.
- **Singularity Threshold**: Pivot magnitude $< 10^{-12}$ triggers explicit singular / rank-deficient termination without division by zero.
- **Verification**: Residual norms $\|Ax - b\|_2$ and $\|Ax - b\|_\infty$. High-order Hilbert systems ($n \ge 7$) are included in `EXP-03` to demonstrate ill-conditioned forward error amplification ($\kappa(H_n) \cdot \varepsilon_{\text{mach}}$) despite small backward residuals.

## 2. Polynomial Interpolation (`interpolation.ts`)
- **Algorithm**: Newton Divided Differences $f[x_i, \dots, x_{i+j}] = \frac{f[x_{i+1},\dots,x_{i+j}] - f[x_i,\dots,x_{i+j-1}]}{x_{i+j} - x_i}$ evaluated in $O(n)$ via Horner's nested form.
- **Validation**: Requires $n \ge 2$ and strictly distinct nodes ($|x_i - x_{i-1}| \ge 10^{-9}$). Reproduces degree-$(n-1)$ polynomials to machine precision at all nodes.

## 3. Householder QR Least Squares & Forecasting (`regression.ts`, `numericalForecaster.ts`)
- **Algorithm**: Design matrix factorization $X = Q R$ using orthogonal Householder reflections, solving $R\hat{\beta} = Q^T y$ by back-substitution. This avoids squaring the condition number ($\kappa(X^T X) = \kappa(X)^2$) inherent in normal equations.
- **Orthogonality Audit**: Computes $\|Q^T Q - I\|_F$ on leading $p$ columns (verified $< 10^{-9}$).
- **Forecasting Features**: Intercept, Fourier diurnal harmonics ($\sin/\cos$ at $24\text{h}$ and $12\text{h}$ periods), linear temperature and cooling degree excess $\max(0, T - 24)$, weekend/holiday indicators, and causal $24\text{h}$ lagged load.
- **Metrics**: MAE, RMSE, sMAPE, $R^2$, and validity-aware MAPE (explicitly marked `mapeValid: false` when any actual value satisfies $|y_t| \le 10^{-6}$).

## 4. Numerical Differentiation & Integration (`differentiation.ts`, `integration.ts`)
- **Differentiation**: Forward ($O(h)$), Backward ($O(h)$), and Central ($O(h^2)$) finite differences for load ramp rates ($\text{MW/h}$) with step-refinement comparison across $h, h/2, h/4$. `finiteDifferenceDerivative` enforces $dt > 0$.
- **Integration**: Composite Trapezoidal ($O(h^2)$) and Composite Simpson's 1/3 ($O(h^4)$) rules integrating $P(t)\,[\text{MW}]$ over $[a,b]\,[\text{h}]$ into energy $[\text{MWh}]$. Simpson's rule enforces even subinterval count $n$ and strictly $b > a$.

## 5. Multi-Period Optimal Energy Dispatch (`boundedSimplex.ts`, `optimalDispatchEngine.ts`)
- **Formulation**: Continuous 24-hour Linear Program solved via Two-Phase Bounded Simplex with Bland's anti-cycling rule (`solveBoundedLP`), handling lower/upper variable bounds directly.
- **Objective (INR)**: Minimize sum of thermal generation fuel/O&M cost, optional renewable O&M, BESS cycling degradation cost, optional carbon price ($\text{INR/tCO}_2\text{e}$), and Value of Lost Load penalty ($\text{VOLL} = ₹25{,}000/\text{MWh}$) on unserved energy $u_t \ge 0$.
- **Constraints**:
  - Hourly nodal power balance: $\sum_i P_{i,t} + P_{\text{dis},t} - P_{\text{ch},t} + u_t - \text{curt}_t = D_t$
  - Generator bounds $P_{i,\min} \le P_{i,t} \le P_{i,\max,t}$ and thermal ramp limits $|P_{i,t} - P_{i,t-1}| \le R_i$
  - BESS SoC dynamics: $E_{t+1} = E_t + \sqrt{\eta}\,P_{\text{ch},t} - P_{\text{dis},t}/\sqrt{\eta}$ with $\eta = 0.90$, $E_{\min} \le E_t \le E_{\max}$, and optional terminal SoC target $E_{24} \ge E_{\text{target}}$.
- **Known Modeling Scope**: Single-bus copper-plate network model (no AC reactive power losses or binary unit-commitment startup costs).
