import { Component, ErrorInfo, ReactNode } from "react";
import { withTranslation, WithTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundaryBase extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("oc-pad uncaught render error", error, errorInfo);
  }

  private reset = () => {
    this.setState({
      hasError: false,
      message: "",
    });
  };

  render() {
    const { children, t } = this.props;
    const { hasError, message } = this.state;

    if (!hasError) {
      return children;
    }

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>{t("app.runtimeErrorTitle")}</CardTitle>
            <CardDescription>{t("app.runtimeErrorDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message ? (
              <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                {message}
              </pre>
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="button" onClick={this.reset}>
                {t("app.retry")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.reload();
                }}
              >
                {t("app.reload")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryBase);
