"""
Lance l'interface MLflow (mlflow ui).

Contourne un bug de compatibilité entre MLflow 3.14.0 et Python 3.14 :
la fonctionnalité "assistant" de MLflow importe `Traversable` depuis
`importlib.abc`, un emplacement supprimé en Python 3.14 (déplacé vers
`importlib.resources.abc`). On restaure l'ancien emplacement avant que
MLflow ne l'importe.
"""
import importlib.abc
import importlib.resources.abc as resources_abc

importlib.abc.Traversable = resources_abc.Traversable

import sys
from mlflow.cli import cli

if __name__ == "__main__":
    sys.argv = ["mlflow", "ui", "--backend-store-uri", "sqlite:///mlflow.db"]
    cli()
